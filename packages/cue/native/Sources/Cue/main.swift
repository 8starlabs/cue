import AppKit
import ApplicationServices
import CoreGraphics
import Carbon.HIToolbox
import SwiftUI
import Darwin

struct Completion: Decodable, Identifiable {
    let name: String
    let displayName: String?
    let description: String?
    let argumentHint: String?
    let typedPrefix: String
    let insertValue: String
    let replaceValue: String?
    let icon: String?
    let type: String?
    let isDangerous: Bool?
    let deprecated: Bool?
    let kind: String
    var id: String { "\(kind):\(name)" }
}

private struct WorkerResponse: Decodable {
    let id: Int
    let completions: [Completion]
}

struct RequestMetadata {
    let cursor: Int
    let columns: Int
    let lines: Int
    let promptWidth: Int
    let terminalRow: Int
    let terminalColumn: Int
    let cwd: String
    let line: String
    let action: String
    let environmentVariables: [String: String]
}

private let maximumVisibleSuggestions = 7
private let maximumSuggestions = 50
private let suggestionRowHeight: CGFloat = 18

private enum PopupSide: Equatable {
    case belowCaret
    case aboveCaret
    case constrained
}

private struct PopupPosition {
    let origin: NSPoint
    let side: PopupSide
    let caretAnchorY: CGFloat?
}

final class CueModel: ObservableObject {
    @Published var completions: [Completion] = []
    @Published var selectedIndex = 0
}

@main
struct CueMain {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let delegate = CueAppDelegate()
        app.delegate = delegate
        app.run()
    }
}

final class CueAppDelegate: NSObject, NSApplicationDelegate {
    private let model = CueModel()
    private var panelController: CuePanelController!
    private var service: CueService!

    func applicationDidFinishLaunching(_ notification: Notification) {
        panelController = CuePanelController(model: model)
        service = CueService(model: model, panelController: panelController)
        service.start()
        _ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary)
    }
}

final class CuePanelController {
    private let panel: NSPanel
    private let hostingView: NSHostingView<CuePanelView>
    private let detailsPanel: NSPanel
    private let detailsHostingView: NSHostingView<CueDetailView>
    private let model: CueModel
    private var visibleCompletions: [Completion] = []
    private var selectedIndex = 0
    private var suggestionWindowStart = 0
    private var hasAcceptedSelection = false
    private var acceptedSelectionBuffer: String?
    private var listOrigin = NSPoint.zero
    private var popupSide = PopupSide.constrained
    private var activeVisibleFrame: CGRect?
    private var terminalWindowRect: CGRect?
    private var latestMetadata: RequestMetadata?
    private var descriptionAtBottom = true
    private var layoutHotKey: EventHotKeyRef?
    private var hotKeyHandler: EventHandlerRef?
    private let panelGap: CGFloat = 4
    private let caretPopupGap: CGFloat = 5
    var isVisible: Bool { panel.isVisible }
    private var acceptedCodeCurrentDirectory: Bool {
        hasAcceptedSelection && acceptedSelectionBuffer == "code ."
    }

    init(model: CueModel) {
        self.model = model
        panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 320, height: 220),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        hostingView = NSHostingView(rootView: CuePanelView(completions: [], selectedIndex: 0, windowStart: 0, description: "", descriptionAtBottom: false, hasAcceptedSelection: false))
        panel.contentView = hostingView
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]

        detailsPanel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 260, height: 60),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        detailsHostingView = NSHostingView(rootView: CueDetailView(description: ""))
        detailsPanel.contentView = detailsHostingView
        detailsPanel.isOpaque = false
        detailsPanel.backgroundColor = .clear
        detailsPanel.hasShadow = true
        detailsPanel.level = .floating
        detailsPanel.hidesOnDeactivate = false
        detailsPanel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
    }

    func show(_ completions: [Completion], metadata: RequestMetadata) {
        guard !completions.isEmpty,
              NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.apple.Terminal" else {
            hide()
            return
        }

        let previousMetadata = latestMetadata
        let previousWindowRect = terminalWindowRect
        let previousTopY = panel.frame.maxY
        let wasVisible = panel.isVisible
        visibleCompletions = Array(completions.prefix(maximumSuggestions))
        if metadata.action == "selected", metadata.line == "code ." {
            if let currentDirectoryIndex = visibleCompletions.firstIndex(where: {
                $0.name == "." && $0.insertValue == "."
            }) {
                let currentDirectory = visibleCompletions.remove(at: currentDirectoryIndex)
                visibleCompletions.insert(currentDirectory, at: 0)
            }
        } else if metadata.action == "selected",
                  let parentIndex = visibleCompletions.firstIndex(where: { $0.name == "../" }) {
            let parent = visibleCompletions.remove(at: parentIndex)
            visibleCompletions.insert(parent, at: 0)
        } else if let parent = parentDirectoryCompletion(for: metadata) {
            visibleCompletions.insert(parent, at: 0)
        }
        if metadata.action == "selected" {
            acceptedSelectionBuffer = metadata.line
        } else if metadata.line != acceptedSelectionBuffer {
            acceptedSelectionBuffer = nil
        }
        hasAcceptedSelection = acceptedSelectionBuffer != nil
        selectedIndex = 0
        suggestionWindowStart = 0
        latestMetadata = metadata
        renderPanel()
        let combinedSize = combinedPanelSize
        if let position = popupOrigin(metadata: metadata, panelSize: combinedSize) {
            var origin = position.origin
            let acceptedDirectory = metadata.action == "selected"
            let sameCaretRow = previousMetadata.map {
                $0.terminalRow > 0 &&
                    $0.terminalRow == metadata.terminalRow &&
                    $0.columns == metadata.columns &&
                    $0.lines == metadata.lines &&
                    $0.cwd == metadata.cwd &&
                    ($0.line.hasPrefix(metadata.line) || metadata.line.hasPrefix($0.line))
            } ?? false
            let sameWindow = rectsMatch(previousWindowRect, terminalWindowRect)
            if wasVisible && sameWindow && popupSide == position.side &&
                position.side != .constrained && (acceptedDirectory || sameCaretRow),
               let caretAnchorY = position.caretAnchorY {
                let visible = activeVisibleFrame ?? CGRect(x: 0, y: 0, width: 1200, height: 800)
                let minimumY = visible.minY + 8
                let preservedY = previousTopY - panel.frame.height
                let preservedMaxY = preservedY + panel.frame.height
                let staysOnSameSide = position.side == .belowCaret
                    ? preservedMaxY <= caretAnchorY - caretPopupGap
                    : preservedY >= caretAnchorY + caretPopupGap
                if preservedY >= minimumY,
                   preservedMaxY <= visible.maxY - 8,
                   staysOnSameSide {
                    origin.y = preservedY
                }
            }
            listOrigin = origin
            popupSide = position.side
            panel.setFrameOrigin(listOrigin)
            if !descriptionAtBottom { positionDetailsPanel() }
        }
        panel.orderFrontRegardless()
        if descriptionAtBottom { detailsPanel.orderOut(nil) }
        else { detailsPanel.orderFrontRegardless() }
        registerLayoutHotKey()
    }

    func hide() {
        panel.orderOut(nil)
        detailsPanel.orderOut(nil)
        visibleCompletions = []
        selectedIndex = 0
        suggestionWindowStart = 0
        hasAcceptedSelection = false
        acceptedSelectionBuffer = nil
        terminalWindowRect = nil
        latestMetadata = nil
        popupSide = .constrained
        unregisterLayoutHotKey()
    }

    func select(_ index: Int) {
        guard !visibleCompletions.isEmpty else { return }
        let lastDisplayIndex = visibleCompletions.count - 1 + (hasAcceptedSelection ? 1 : 0)
        selectedIndex = min(max(0, index), lastDisplayIndex)
        let displayCount = visibleCompletions.count + (hasAcceptedSelection ? 1 : 0)
        if selectedIndex < suggestionWindowStart {
            suggestionWindowStart = selectedIndex
        } else if selectedIndex >= suggestionWindowStart + maximumVisibleSuggestions {
            suggestionWindowStart = selectedIndex - maximumVisibleSuggestions + 1
        }
        suggestionWindowStart = min(suggestionWindowStart, max(0, displayCount - maximumVisibleSuggestions))
        renderPanel()
        if !descriptionAtBottom { positionDetailsPanel() }
    }

    private var combinedPanelSize: NSSize {
        NSSize(
            width: panel.frame.width + (descriptionAtBottom ? 0 : panelGap + detailsPanel.frame.width),
            height: panel.frame.height
        )
    }

    private func renderPanel() {
        let enterOption = Completion(
            name: "↵",
            displayName: nil,
            description: acceptedCodeCurrentDirectory ? "Open the current directory" : "Enter the current directory",
            argumentHint: nil,
            typedPrefix: "",
            insertValue: "",
            replaceValue: nil,
            icon: nil,
            type: nil,
            isDangerous: nil,
            deprecated: nil,
            kind: "enter"
        )
        let displayCompletions: [Completion]
        if acceptedCodeCurrentDirectory {
            var suggestions = visibleCompletions
            if let currentDirectoryIndex = suggestions.firstIndex(where: {
                $0.name == "." && $0.insertValue == "."
            }) {
                let currentDirectory = suggestions.remove(at: currentDirectoryIndex)
                suggestions.insert(currentDirectory, at: 0)
            }
            suggestions.insert(enterOption, at: min(1, suggestions.count))
            displayCompletions = suggestions
        } else if hasAcceptedSelection {
            displayCompletions = [enterOption] + visibleCompletions
        } else {
            displayCompletions = visibleCompletions
        }
        let description = displayCompletions.indices.contains(selectedIndex)
            ? displayCompletions[selectedIndex].description ?? ""
            : ""
        hostingView.rootView = CuePanelView(
            completions: displayCompletions,
            selectedIndex: selectedIndex,
            windowStart: suggestionWindowStart,
            description: description,
            descriptionAtBottom: descriptionAtBottom,
            hasAcceptedSelection: hasAcceptedSelection
        )
        hostingView.layoutSubtreeIfNeeded()
        let size = hostingView.fittingSize
        panel.setContentSize(NSSize(width: max(descriptionAtBottom ? 400 : 250, size.width), height: size.height))
        detailsHostingView.rootView = CueDetailView(description: description)
        detailsHostingView.layoutSubtreeIfNeeded()
        detailsPanel.setContentSize(detailsHostingView.fittingSize)
    }

    private func toggleDescriptionLayout() {
        guard panel.isVisible, !visibleCompletions.isEmpty else { return }
        descriptionAtBottom.toggle()
        renderPanel()
        if let latestMetadata,
           let position = popupOrigin(metadata: latestMetadata, panelSize: combinedPanelSize) {
            listOrigin = position.origin
            popupSide = position.side
            panel.setFrameOrigin(position.origin)
        }
        if descriptionAtBottom {
            detailsPanel.orderOut(nil)
        } else {
            positionDetailsPanel()
            detailsPanel.orderFrontRegardless()
        }
        panel.orderFrontRegardless()
    }

    private func registerLayoutHotKey() {
        guard layoutHotKey == nil else { return }
        let hotKeyID = EventHotKeyID(signature: OSType(0x43554531), id: 1)
        if hotKeyHandler == nil {
            var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
            let callback: EventHandlerUPP = { _, event, userData in
                guard let event, let userData else { return noErr }
                var pressedHotKey = EventHotKeyID()
                let status = GetEventParameter(
                    event,
                    EventParamName(kEventParamDirectObject),
                    EventParamType(typeEventHotKeyID),
                    nil,
                    MemoryLayout<EventHotKeyID>.size,
                    nil,
                    &pressedHotKey
                )
                guard status == noErr, pressedHotKey.id == 1 else { return noErr }
                let controller = Unmanaged<CuePanelController>.fromOpaque(userData).takeUnretainedValue()
                DispatchQueue.main.async { controller.toggleDescriptionLayout() }
                return noErr
            }
            InstallEventHandler(
                GetApplicationEventTarget(), callback, 1, &eventType,
                Unmanaged.passUnretained(self).toOpaque(), &hotKeyHandler
            )
        }
        RegisterEventHotKey(UInt32(kVK_ANSI_I), UInt32(cmdKey), hotKeyID, GetApplicationEventTarget(), 0, &layoutHotKey)
    }

    private func unregisterLayoutHotKey() {
        if let layoutHotKey {
            UnregisterEventHotKey(layoutHotKey)
            self.layoutHotKey = nil
        }
    }

    private func positionDetailsPanel() {
        let listTop = listOrigin.y + panel.frame.height - 6
        let selectedRow = selectedIndex - suggestionWindowStart
        let selectedRowTop = listTop - CGFloat(selectedRow) * suggestionRowHeight
        let visible = activeVisibleFrame ?? (NSScreen.main ?? NSScreen.screens.first)?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1200, height: 800)
        let detailsY = min(visible.maxY - detailsPanel.frame.height - 8, max(visible.minY + 8, selectedRowTop - detailsPanel.frame.height))
        detailsPanel.setFrameOrigin(NSPoint(x: listOrigin.x + panel.frame.width + panelGap, y: detailsY))
    }

    private func parentDirectoryCompletion(for metadata: RequestMetadata) -> Completion? {
        guard metadata.action == "selected" else { return nil }
        let line = metadata.line.trimmingCharacters(in: .whitespaces)
        guard line == "cd" || line.hasPrefix("cd "),
              !line.contains("\""), !line.contains("'"), !line.contains("\\") else { return nil }

        let partial = line == "cd" ? "" : String(line.dropFirst(3))
        let slash = partial.lastIndex(of: "/")
        let directoryPrefix = slash.map { String(partial[...$0]) } ?? ""
        let namePrefix = slash.map { String(partial[partial.index(after: $0)...]) } ?? partial
        guard namePrefix.isEmpty || namePrefix.hasPrefix(".") else { return nil }

        let targetPath: String
        if directoryPrefix.hasPrefix("~/") {
            targetPath = NSHomeDirectory() + directoryPrefix.dropFirst()
        } else if directoryPrefix.hasPrefix("$HOME/") {
            targetPath = NSHomeDirectory() + directoryPrefix.dropFirst(5)
        } else if directoryPrefix.hasPrefix("/") {
            targetPath = directoryPrefix
        } else if directoryPrefix.isEmpty {
            targetPath = metadata.cwd
        } else {
            targetPath = URL(fileURLWithPath: metadata.cwd, isDirectory: true)
                .appendingPathComponent(directoryPrefix).path
        }

        let standardizedTarget = URL(fileURLWithPath: targetPath, isDirectory: true).standardizedFileURL.path
        guard standardizedTarget != "/" else { return nil }

        return Completion(
            name: "../",
            displayName: nil,
            description: "Parent folder",
            argumentHint: nil,
            typedPrefix: namePrefix,
            insertValue: "\(directoryPrefix)../",
            replaceValue: nil,
            icon: "fig://icon?type=folder",
            type: nil,
            isDangerous: false,
            deprecated: false,
            kind: "argument"
        )
    }

    private func popupOrigin(metadata: RequestMetadata, panelSize: NSSize) -> PopupPosition? {
        let terminalPID = NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0
        let app = AXUIElementCreateApplication(terminalPID)
        var windowValue: CFTypeRef?
        var windowElement: AXUIElement?
        var axWindowRect: CGRect?
        if AXUIElementCopyAttributeValue(app, kAXFocusedWindowAttribute as CFString, &windowValue) == .success,
           let windowValue {
            let focusedWindow = unsafeBitCast(windowValue, to: AXUIElement.self)
            if let rect = axRect(focusedWindow).flatMap(validWindowRect) {
                windowElement = focusedWindow
                axWindowRect = rect
            }
        }
        if windowElement == nil {
            var windowsValue: CFTypeRef?
            if AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &windowsValue) == .success,
               let windows = windowsValue as? [AXUIElement] {
                windowElement = windows.first(where: { element in
                    guard let rect = axRect(element) else { return false }
                    return validWindowRect(rect) != nil
                }) ?? windows.first
                axWindowRect = windowElement.flatMap(axRect).flatMap(validWindowRect)
            }
        }
        let serverWindowRect = windowServerRect(for: terminalPID).flatMap(validWindowRect)
        // WindowServer and CGDisplayBounds share Quartz's global display
        // coordinates. Accessibility window bounds can use a different screen
        // origin on vertically arranged Retina displays, so use AX only as a
        // fallback for locating the Terminal window.
        let windowRect = serverWindowRect ?? axWindowRect
        terminalWindowRect = windowRect

        var focusedValue: CFTypeRef?
        var focusedElement: AXUIElement?
        var textRect: CGRect?
        if AXUIElementCopyAttributeValue(app, kAXFocusedUIElementAttribute as CFString, &focusedValue) == .success,
           let focusedValue {
            focusedElement = unsafeBitCast(focusedValue, to: AXUIElement.self)
            if let candidate = focusedElement.flatMap(axRect),
               candidate.width > 100, candidate.height > 100,
               candidate.origin.x.isFinite, candidate.origin.y.isFinite,
               windowRect.map({ $0.insetBy(dx: -24, dy: -24).contains(CGPoint(x: candidate.midX, y: candidate.midY)) }) ?? false {
                textRect = candidate
            }
        }

        let screen = serverWindowRect.flatMap(screenForTerminalWindow)
            ?? axWindowRect.flatMap(screenForTerminalWindow)
            ?? NSScreen.main
            ?? NSScreen.screens.first
        activeVisibleFrame = screen?.visibleFrame
        let columns = max(1, metadata.columns)
        let lines = max(1, metadata.lines)
        let absoluteColumn = max(0, metadata.promptWidth + metadata.cursor)
        let fallbackRow = lines - 2
        let column = absoluteColumn % columns
        var x: CGFloat
        var y: CGFloat
        var caretAnchorY: CGFloat?
        if let windowRect, metadata.terminalRow > 0 {
            // Derive the live column from zsh's measured prompt width and
            // cursor index. DSR columns can lag after a completion edit, so
            // don't use them to place the popup horizontally.
            let textRect = textRect ?? windowRect.insetBy(dx: 12, dy: 34)
            let cellWidth = textRect.width / CGFloat(columns)
            let cellHeight = textRect.height / CGFloat(lines)
            let terminalColumn = min(columns - 1, max(0, absoluteColumn % columns))
            let terminalRow = min(lines - 1, max(0, metadata.terminalRow - 1))
            let anchor = appKitPoint(fromQuartz: CGPoint(
                x: textRect.minX + CGFloat(terminalColumn) * cellWidth,
                y: textRect.minY + CGFloat(terminalRow + 1) * cellHeight
            ), on: screen)
            x = anchor.x
            caretAnchorY = anchor.y
            y = anchor.y - panelSize.height - caretPopupGap
        } else if let focusedElement, let caret = axCaretRect(focusedElement),
           caret.width <= max(18, (textRect?.width ?? windowRect?.width ?? 800) / CGFloat(columns) * 1.5),
           caret.height > 4, caret.origin.x.isFinite, caret.origin.y.isFinite,
           axWindowRect.map({ $0.insetBy(dx: -24, dy: -24).contains(CGPoint(x: caret.minX, y: caret.midY)) }) ?? true {
            let anchor = appKitPoint(fromQuartz: CGPoint(x: caret.minX, y: caret.maxY), on: screen)
            x = anchor.x
            caretAnchorY = anchor.y
            y = anchor.y - panelSize.height - caretPopupGap
        } else if let windowRect {
            let textRect = textRect ?? windowRect.insetBy(dx: 12, dy: 34)
            let cellWidth = textRect.width / CGFloat(columns)
            let cellHeight = textRect.height / CGFloat(lines)
            let anchor = appKitPoint(fromQuartz: CGPoint(
                x: textRect.minX + CGFloat(column) * cellWidth,
                y: textRect.minY + CGFloat(max(0, fallbackRow + 1)) * cellHeight
            ), on: screen)
            x = anchor.x
            caretAnchorY = anchor.y
            y = anchor.y - panelSize.height - caretPopupGap
        } else {
            let visible = screen?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1200, height: 800)
            let estimatedColumn = CGFloat(absoluteColumn) * 8.5
            x = visible.minX + 18 + estimatedColumn
            y = visible.minY + 110
        }
        let visible = screen?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1200, height: 800)
        let edgePadding: CGFloat = 8
        let maxOriginY = max(visible.minY + edgePadding, visible.maxY - panelSize.height - edgePadding)
        var side = PopupSide.constrained
        if let caretAnchorY {
            let availableBelow = caretAnchorY - visible.minY - edgePadding - caretPopupGap
            let availableAbove = visible.maxY - caretAnchorY - edgePadding - caretPopupGap
            if availableBelow >= panelSize.height {
                y = caretAnchorY - panelSize.height - caretPopupGap
                side = .belowCaret
            } else if availableAbove >= panelSize.height {
                y = caretAnchorY + caretPopupGap
                side = .aboveCaret
            } else if availableAbove > availableBelow {
                y = caretAnchorY + caretPopupGap
            } else {
                y = caretAnchorY - panelSize.height - caretPopupGap
            }
        }
        y = min(max(y, visible.minY + edgePadding), maxOriginY)
        let maxOriginX = max(visible.minX + edgePadding, visible.maxX - panelSize.width - edgePadding)
        x = min(max(x, visible.minX + edgePadding), maxOriginX)
        return PopupPosition(origin: NSPoint(x: x, y: y), side: side, caretAnchorY: caretAnchorY)
    }

    private func rectsMatch(_ lhs: CGRect?, _ rhs: CGRect?) -> Bool {
        guard let lhs, let rhs else { return false }
        return abs(lhs.origin.x - rhs.origin.x) < 1 &&
            abs(lhs.origin.y - rhs.origin.y) < 1 &&
            abs(lhs.width - rhs.width) < 1 &&
            abs(lhs.height - rhs.height) < 1
    }

    private func screenForTerminalWindow(_ rect: CGRect) -> NSScreen? {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        return NSScreen.screens.first { screen in
            guard let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else { return false }
            return CGDisplayBounds(CGDirectDisplayID(number.uint32Value)).contains(center)
        }
    }

    private func appKitPoint(fromQuartz point: CGPoint, on screen: NSScreen?) -> CGPoint {
        guard let screen,
              let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else {
            let fallback = NSScreen.main ?? NSScreen.screens.first
            return CGPoint(x: point.x, y: (fallback?.frame.maxY ?? 900) - point.y)
        }
        let quartzFrame = CGDisplayBounds(CGDirectDisplayID(number.uint32Value))
        let appKitFrame = screen.frame
        return CGPoint(
            x: appKitFrame.minX + point.x - quartzFrame.minX,
            y: appKitFrame.maxY - (point.y - quartzFrame.minY)
        )
    }

    private func axCaretRect(_ element: AXUIElement) -> CGRect? {
        var rangeValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, &rangeValue) == .success,
              let rangeValue else { return nil }
        var boundsValue: CFTypeRef?
        guard AXUIElementCopyParameterizedAttributeValue(element, kAXBoundsForRangeParameterizedAttribute as CFString, rangeValue, &boundsValue) == .success,
              let boundsValue else { return nil }
        var rect = CGRect.zero
        guard AXValueGetValue(unsafeBitCast(boundsValue, to: AXValue.self), .cgRect, &rect) else { return nil }
        return rect
    }

    private func validWindowRect(_ rect: CGRect) -> CGRect? {
        rect.width > 200 && rect.height > 100 && rect.origin.x.isFinite && rect.origin.y.isFinite ? rect : nil
    }

    private func windowServerRect(for pid: pid_t) -> CGRect? {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else { return nil }
        for window in windows {
            guard (window[kCGWindowOwnerPID as String] as? Int) == Int(pid),
                  (window[kCGWindowLayer as String] as? Int) == 0,
                  let bounds = window[kCGWindowBounds as String] as? NSDictionary,
                  let rect = CGRect(dictionaryRepresentation: bounds) else { continue }
            return rect
        }
        return nil
    }

    private func axRect(_ element: AXUIElement) -> CGRect? {
        var positionValue: CFTypeRef?
        var sizeValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &positionValue) == .success,
              AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &sizeValue) == .success,
              let positionValue, let sizeValue else { return nil }
        var point = CGPoint.zero
        var size = CGSize.zero
        guard AXValueGetValue(unsafeBitCast(positionValue, to: AXValue.self), .cgPoint, &point),
              AXValueGetValue(unsafeBitCast(sizeValue, to: AXValue.self), .cgSize, &size) else { return nil }
        return CGRect(origin: point, size: size)
    }
}

struct CuePanelView: View {
    let completions: [Completion]
    let selectedIndex: Int
    let windowStart: Int
    let description: String
    let descriptionAtBottom: Bool
    let hasAcceptedSelection: Bool

    private var visibleSuggestions: [(offset: Int, element: Completion)] {
        let start = min(max(0, windowStart), max(0, completions.count - maximumVisibleSuggestions))
        return Array(completions.enumerated().dropFirst(start).prefix(maximumVisibleSuggestions))
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(visibleSuggestions, id: \.element.id) { index, completion in
                HStack(spacing: 3) {
                    ZStack(alignment: .bottomTrailing) {
                        CueIcon(icon: completion.icon, kind: completion.kind, name: completion.name, suggestionType: completion.type)
                            .frame(width: 16, height: 16)
                        if completion.isDangerous == true {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 6, weight: .bold))
                                .foregroundStyle(Color(red: 1, green: 0.32, blue: 0.24))
                                .background(Color.black, in: Circle())
                                .offset(x: 2, y: 2)
                        }
                    }
                    .frame(width: 16, height: 16)
                    suggestionLabel(completion, selected: index == selectedIndex)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 2)
                .frame(width: descriptionAtBottom ? 396 : 246, height: suggestionRowHeight)
                .foregroundStyle(Color.white)
                .background(index == selectedIndex ? Color(red: 0.18, green: 0.37, blue: 0.75) : Color.clear, in: RoundedRectangle(cornerRadius: 3))
            }
            if descriptionAtBottom {
                Rectangle()
                    .fill(Color.white.opacity(0.12))
                    .frame(height: 1)
                    .padding(.horizontal, 3)
                HStack(alignment: .center, spacing: 8) {
                    Text(description.isEmpty ? "No additional description" : description)
                        .font(.system(size: 11).italic())
                        .foregroundStyle(Color.white.opacity(0.72))
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("(⌘I)")
                        .font(.custom("Menlo-Regular", size: 7.5))
                        .foregroundStyle(Color.white.opacity(0.46))
                }
                .padding(.horizontal, 4)
                .padding(.vertical, 3)
                .frame(width: 396, alignment: .leading)
            }
        }
        .padding(1.5)
        .frame(width: descriptionAtBottom ? 400 : 250)
        .background(Color(red: 0.18, green: 0.18, blue: 0.19), in: RoundedRectangle(cornerRadius: 5))
        .overlay(RoundedRectangle(cornerRadius: 5).stroke(Color(red: 0.23, green: 0.23, blue: 0.24), lineWidth: 1))
    }

    private func suggestionLabel(_ completion: Completion, selected: Bool) -> some View {
        let title = completion.displayName ?? completion.name
        let canHighlightPrefix = title == completion.name && completion.name.lowercased().hasPrefix(completion.typedPrefix.lowercased())
        let prefixLength = canHighlightPrefix ? min(completion.typedPrefix.count, title.count) : 0
        let matched = String(title.prefix(prefixLength))
        let remainder = String(title.dropFirst(prefixLength))
        return HStack(spacing: 0) {
            Text(matched)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .background(Color(red: 0.82, green: 0.67, blue: 0.24).opacity(0.48))
            Text(remainder)
                .foregroundColor(selected ? .white : Color.white.opacity(0.68))
            Text(completion.argumentHint.map { "  \($0)" } ?? "")
                .foregroundColor(Color.white.opacity(0.48))
        }
            .font(.custom(selected ? "Menlo-Bold" : "Menlo-Regular", size: 11))
            .tracking(0.3)
            .strikethrough(completion.deprecated == true, color: .white.opacity(0.55))
            .lineLimit(1)
    }
}

struct CueDetailView: View {
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(description.isEmpty ? "No additional description" : description)
                .font(.system(size: 10).italic())
                .foregroundStyle(Color(red: 0.86, green: 0.86, blue: 0.88))
                .lineLimit(6)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack {
                Spacer(minLength: 0)
                Text("(⌘I)")
                    .font(.custom("Menlo-Regular", size: 7.5))
                    .foregroundStyle(Color.white.opacity(0.46))
            }
        }
        .padding(7)
        .frame(width: 260, alignment: .topLeading)
        .background(Color(red: 0.27, green: 0.27, blue: 0.28), in: RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(red: 0.34, green: 0.34, blue: 0.35), lineWidth: 1))
    }
}

struct CueIcon: View {
    let icon: String?
    let kind: String
    let name: String
    let suggestionType: String?

    var body: some View {
        if kind == "enter" {
            Image(systemName: "chevron.right")
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 14, height: 14)
                .background(Color(red: 0.92, green: 0.25, blue: 0.22), in: RoundedRectangle(cornerRadius: 4))
        } else if let icon, let url = URL(string: icon), ["https", "http"].contains(url.scheme?.lowercased() ?? "") {
            AsyncImage(url: url) { image in
                image.resizable().scaledToFit().padding(1)
            } placeholder: {
                EmptyView()
            }
        } else if let icon, icon.hasPrefix("fig://template") {
            templateIcon(icon)
        } else if let icon, !icon.hasPrefix("fig://") {
            Text(icon)
                .font(.system(size: 13))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let image = figImage(icon, kind: kind, name: name, suggestionType: suggestionType) {
            ZStack(alignment: .bottomTrailing) {
                Image(nsImage: image).resizable().scaledToFit().padding(1)
                if let badge = iconBadge(icon) {
                    Text(badge)
                        .font(.system(size: 7, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 2)
                        .frame(minWidth: 9, minHeight: 9)
                        .background(iconColor(icon, fallback: Color(red: 1, green: 0, blue: 0)), in: RoundedRectangle(cornerRadius: 3))
                        .offset(x: 2, y: 2)
                }
            }
        } else {
            EmptyView()
        }
    }

    private func templateIcon(_ value: String) -> some View {
        let badge = iconBadge(value)
        return ZStack {
            RoundedRectangle(cornerRadius: 4).fill(iconColor(value, fallback: .white))
            if let badge {
                Text(badge)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.black.opacity(0.82))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        }
        .frame(width: 15, height: 15)
    }

    private func queryValue(_ value: String?, key: String) -> String? {
        guard let value, let components = URLComponents(string: value) else { return nil }
        return components.queryItems?.first(where: { $0.name == key })?.value
    }

    private func iconBadge(_ value: String?) -> String? {
        queryValue(value, key: "badge")
    }

    private func iconColor(_ value: String?, fallback: Color) -> Color {
        guard let raw = queryValue(value, key: "color"), raw.count == 6,
              let number = UInt64(raw, radix: 16) else { return fallback }
        return Color(
            red: Double((number >> 16) & 0xff) / 255,
            green: Double((number >> 8) & 0xff) / 255,
            blue: Double(number & 0xff) / 255
        )
    }

    private func iconType(_ value: String?) -> String {
        guard let value, let components = URLComponents(string: value),
              let type = components.queryItems?.first(where: { $0.name == "type" })?.value else { return "" }
        return type
    }

    private func figImage(_ value: String?, kind: String, name: String, suggestionType: String?) -> NSImage? {
        let explicitType = iconType(value)
        if let value, value.hasPrefix("fig://"), !value.hasPrefix("fig://icon"), !value.hasPrefix("fig://template") {
            var filePath = String(value.dropFirst("fig://".count)).components(separatedBy: "?").first ?? ""
            if filePath.hasPrefix("~/") { filePath = (NSHomeDirectory() as NSString).appendingPathComponent(String(filePath.dropFirst(2))) }
            if filePath.hasPrefix("/") || filePath.hasPrefix("~") {
                let image = NSWorkspace.shared.icon(forFile: filePath)
                image.size = NSSize(width: 16, height: 16)
                return image
            }
        }
        let fallbackType: String
        switch suggestionType {
        case "subcommand", "command": fallbackType = "command"
        case "option": fallbackType = "option"
        case "folder": fallbackType = "default-folder-icon"
        case "file": fallbackType = "default-file-icon"
        default:
            switch kind {
            case "command": fallbackType = "command"
            case "option": fallbackType = "option"
            default: fallbackType = name.hasSuffix("/") ? "default-folder-icon" : "default-file-icon"
            }
        }

        let types = explicitType.isEmpty ? [fallbackType] : [explicitType, fallbackType]
        for type in types {
            for ext in ["png", "svg"] {
                let url = Bundle.main.bundleURL
                    .appendingPathComponent("Contents/Resources/FigIcons", isDirectory: true)
                    .appendingPathComponent("\(type).\(ext)")
                if let image = NSImage(contentsOf: url) { return image }
            }
        }
        return nil
    }
}

final class CueService {
    private let model: CueModel
    private let panelController: CuePanelController
    private let engineQueue = DispatchQueue(label: "cue.engine")
    private var process: Process?
    private var workerInput: FileHandle?
    private var outputBuffer = Data()
    private var latestID = 0
    private let latestIDLock = NSLock()
    private var inFlightID: Int?
    private var latestRequest: (id: Int, metadata: RequestMetadata)?
    private var pendingMetadata: [Int: RequestMetadata] = [:]
    private let socketPath = "/tmp/cue-\(getuid()).sock"
    private let completionCachePath = "/tmp/cue-\(getuid()).sock.cache"
    private var visibilityTimer: Timer?
    private var activationObserver: NSObjectProtocol?
    private var previousTerminalWindow: (id: CGWindowID, frame: CGRect)?

    init(model: CueModel, panelController: CuePanelController) {
        self.model = model
        self.panelController = panelController
    }

    func start() {
        unlink(completionCachePath)
        startWorker()
        startSocket()
        startVisibilityMonitor()
    }

    private func cacheCompletions(_ completions: [Completion], for metadata: RequestMetadata) {
        var data = Data()
        func appendField(_ value: String) {
            data.append(contentsOf: value.utf8)
            data.append(0)
        }
        appendField(metadata.line)
        appendField(metadata.cwd)
        for completion in completions {
            appendField(completion.insertValue)
            appendField(completion.replaceValue ?? "")
            appendField(completion.description ?? "")
        }

        let temporaryPath = "\(completionCachePath).\(getpid()).tmp"
        unlink(temporaryPath)
        let descriptor = open(temporaryPath, O_WRONLY | O_CREAT | O_EXCL, mode_t(0o600))
        guard descriptor >= 0 else { return }
        let wroteAllData = data.withUnsafeBytes { bytes -> Bool in
            guard let baseAddress = bytes.baseAddress else { return data.isEmpty }
            var offset = 0
            while offset < bytes.count {
                let written = Darwin.write(descriptor, baseAddress.advanced(by: offset), bytes.count - offset)
                guard written > 0 else { return false }
                offset += written
            }
            return true
        }
        close(descriptor)
        guard wroteAllData, rename(temporaryPath, completionCachePath) == 0 else {
            unlink(temporaryPath)
            return
        }
    }

    private func startVisibilityMonitor() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.activationObserver = NSWorkspace.shared.notificationCenter.addObserver(
                forName: NSWorkspace.didActivateApplicationNotification,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                guard let self else { return }
                let activatedApp = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
                if activatedApp?.bundleIdentifier != "com.apple.Terminal" {
                    self.panelController.hide()
                }
            }
            self.visibilityTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                guard let self else { return }
                guard NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.apple.Terminal" else {
                    self.panelController.hide()
                    self.previousTerminalWindow = nil
                    return
                }
                guard self.panelController.isVisible else {
                    self.previousTerminalWindow = nil
                    return
                }
                let terminal = AXUIElementCreateApplication(NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0)
                var windowsValue: CFTypeRef?
                if AXUIElementCopyAttributeValue(terminal, kAXWindowsAttribute as CFString, &windowsValue) == .success,
                   let windows = windowsValue as? [AXUIElement], windows.isEmpty {
                    self.panelController.hide()
                }
                let currentWindow = self.frontmostTerminalWindow()
                if self.panelController.isVisible,
                   let previous = self.previousTerminalWindow,
                   let currentWindow,
                   (previous.id != currentWindow.id || previous.frame != currentWindow.frame) {
                    self.panelController.hide()
                }
                self.previousTerminalWindow = currentWindow
            }
        }
    }

    private func frontmostTerminalWindow() -> (id: CGWindowID, frame: CGRect)? {
        guard let app = NSWorkspace.shared.frontmostApplication,
              app.bundleIdentifier == "com.apple.Terminal",
              let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
            return nil
        }
        for window in windows {
            guard (window[kCGWindowOwnerPID as String] as? Int) == Int(app.processIdentifier),
                  (window[kCGWindowLayer as String] as? Int) == 0,
                  let id = (window[kCGWindowNumber as String] as? NSNumber)?.uint32Value,
                  let bounds = window[kCGWindowBounds as String] as? NSDictionary,
                  let frame = CGRect(dictionaryRepresentation: bounds) else { continue }
            return (id, frame)
        }
        return nil
    }

    private func startWorker() {
        guard let resourceURL = Bundle.main.resourceURL else { return }
        let runtimeURL = resourceURL.appendingPathComponent("CueRuntime", isDirectory: true)
        let workerURL = runtimeURL.appendingPathComponent("dist/worker.js")
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["node", workerURL.path]
        process.currentDirectoryURL = runtimeURL
        process.environment = ["PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin", "NODE_PATH": runtimeURL.appendingPathComponent("node_modules").path]
        let input = Pipe()
        let output = Pipe()
        process.standardInput = input
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            self?.consumeWorkerOutput(data)
        }
        do {
            try process.run()
            self.process = process
            workerInput = input.fileHandleForWriting
        } catch {
            NSLog("Cue worker failed to start: %@", error.localizedDescription)
        }
    }

    private func startSocket() {
        unlink(socketPath)
        let server = socket(AF_UNIX, SOCK_STREAM, 0)
        guard server >= 0 else { return }
        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        address.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
        let pathCapacity = MemoryLayout.size(ofValue: address.sun_path)
        _ = socketPath.withCString { path in
            withUnsafeMutablePointer(to: &address.sun_path) { pointer in
                pointer.withMemoryRebound(to: CChar.self, capacity: pathCapacity) { target in
                    strncpy(target, path, pathCapacity - 1)
                }
            }
        }
        let previousUmask = umask(mode_t(0o177))
        let bound = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(server, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        _ = umask(previousUmask)
        guard bound == 0, listen(server, 16) == 0 else { close(server); return }
        guard chmod(socketPath, mode_t(0o600)) == 0 else {
            close(server)
            unlink(socketPath)
            return
        }
        DispatchQueue.global(qos: .userInteractive).async { [weak self] in
            while let self {
                let client = accept(server, nil, nil)
                if client < 0 { continue }
                DispatchQueue.global(qos: .userInteractive).async { [weak self] in
                    guard let self else { close(client); return }
                    self.serve(client)
                }
            }
        }
    }

    private func serve(_ client: Int32) {
        var buffered = Data()
        while let packet = Self.readPacket(from: client, buffered: &buffered) {
            if let metadata = Self.parse(packet) { submit(metadata) }
        }
        close(client)
    }

    private static func readPacket(from fd: Int32, buffered: inout Data) -> Data? {
        var buffer = [UInt8](repeating: 0, count: 8192)
        while true {
            if let delimiter = buffered.range(of: Data([0, 0])) {
                let packet = Data(buffered[..<delimiter.lowerBound])
                buffered.removeSubrange(..<delimiter.upperBound)
                return packet
            }
            guard buffered.count < 1_048_576 else { return nil }
            let count = recv(fd, &buffer, buffer.count, 0)
            guard count > 0 else { return nil }
            buffered.append(contentsOf: buffer[0..<count])
        }
    }

    private static func parse(_ data: Data) -> RequestMetadata? {
        let bytes = [UInt8](data)
        guard let separator = bytes.firstIndex(of: 0),
              let header = String(bytes: bytes[..<separator], encoding: .utf8),
              let line = String(bytes: bytes[(separator + 1)...], encoding: .utf8) else { return nil }
        let fields = header.split(separator: "\t", maxSplits: 8, omittingEmptySubsequences: false)
        guard fields.count >= 5,
              let cursor = Int(fields[0]), let columns = Int(fields[1]),
              let lines = Int(fields[2]), let promptWidth = Int(fields[3]) else { return nil }
        let hasCursorPosition = fields.count >= 7
        let terminalRow = hasCursorPosition ? Int(fields[4]) ?? 0 : 0
        let terminalColumn = hasCursorPosition ? Int(fields[5]) ?? 0 : 0
        let cwdIndex = hasCursorPosition ? 6 : 4
        let actionIndex = hasCursorPosition ? 7 : 5
        let action = fields.indices.contains(actionIndex) ? String(fields[actionIndex]) : ""
        let environmentIndex = hasCursorPosition ? 8 : 6
        let encodedEnvironment = fields.indices.contains(environmentIndex) ? String(fields[environmentIndex]) : ""
        let environmentData = Data(base64Encoded: encodedEnvironment) ?? Data()
        let environmentText = String(data: environmentData, encoding: .utf8) ?? ""
        var environmentVariables: [String: String] = [:]
        for entry in environmentText.split(separator: "\0", omittingEmptySubsequences: true) {
            guard let separator = entry.firstIndex(of: "=") else { continue }
            environmentVariables[String(entry[..<separator])] = String(entry[entry.index(after: separator)...])
        }
        return RequestMetadata(cursor: cursor, columns: columns, lines: lines, promptWidth: promptWidth, terminalRow: terminalRow, terminalColumn: terminalColumn, cwd: String(fields[cwdIndex]), line: line, action: action, environmentVariables: environmentVariables)
    }

    private func submit(_ metadata: RequestMetadata) {
        if metadata.action == "hide" {
            // Hide on the next main-thread turn instead of waiting behind
            // completion work queued on the engine.
            DispatchQueue.main.async { self.panelController.hide() }
            latestIDLock.lock()
            latestID += 1
            let hideID = latestID
            latestIDLock.unlock()
            engineQueue.async {
                self.latestIDLock.lock()
                let isStillHidden = self.latestID == hideID
                self.latestIDLock.unlock()
                if isStillHidden { self.latestRequest = nil }
            }
            return
        }
        if metadata.action.hasPrefix("select:"), let index = Int(metadata.action.dropFirst("select:".count)) {
            DispatchQueue.main.async { self.panelController.select(index) }
            return
        }
        latestIDLock.lock()
        latestID += 1
        let requestID = latestID
        latestIDLock.unlock()
        engineQueue.async { [weak self] in
            guard let self else { return }
            self.latestIDLock.lock()
            let isLatest = self.latestID == requestID
            self.latestIDLock.unlock()
            guard isLatest else { return }
            self.latestRequest = (requestID, metadata)
            if self.inFlightID == nil { self.sendLatestRequest() }
        }
    }

    private func sendLatestRequest() {
        guard let request = latestRequest, let workerInput else { return }
        latestIDLock.lock()
        let isLatest = request.id == latestID
        latestIDLock.unlock()
        guard isLatest else {
            latestRequest = nil
            return
        }
        let body: [String: Any] = ["id": request.id, "line": request.metadata.line, "cwd": request.metadata.cwd, "environmentVariables": request.metadata.environmentVariables]
        guard let data = try? JSONSerialization.data(withJSONObject: body),
              var text = String(data: data, encoding: .utf8) else { return }
        text.append("\n")
        do {
            try workerInput.write(contentsOf: Data(text.utf8))
            inFlightID = request.id
            pendingMetadata[request.id] = request.metadata
            latestRequest = nil
        } catch {
            NSLog("Cue worker write failed: %@", error.localizedDescription)
        }
    }

    private func consumeWorkerOutput(_ data: Data) {
        engineQueue.async { [weak self] in
            guard let self else { return }
            self.outputBuffer.append(data)
            while let newline = self.outputBuffer.firstIndex(of: 10) {
                let lineData = self.outputBuffer[..<newline]
                self.outputBuffer.removeSubrange(...newline)
                guard let response = try? JSONDecoder().decode(WorkerResponse.self, from: lineData) else { continue }
                let metadata = self.pendingMetadata.removeValue(forKey: response.id)
                self.inFlightID = nil
                self.latestIDLock.lock()
                let isLatest = response.id == self.latestID
                self.latestIDLock.unlock()
                if isLatest, let metadata {
                    self.cacheCompletions(response.completions, for: metadata)
                    DispatchQueue.main.async {
                        self.model.completions = response.completions
                        self.model.selectedIndex = 0
                        if !response.completions.isEmpty {
                            self.panelController.show(response.completions, metadata: metadata)
                        } else {
                            self.panelController.hide()
                        }
                    }
                }
                if self.latestRequest != nil { self.sendLatestRequest() }
            }
        }
    }
}
