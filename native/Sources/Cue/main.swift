import AppKit
import ApplicationServices
import SwiftUI
import Darwin

struct Completion: Decodable, Identifiable {
    let name: String
    let description: String?
    let insertValue: String
    let icon: String?
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
    let cwd: String
    let line: String
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
    private let model: CueModel

    init(model: CueModel) {
        self.model = model
        panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 250),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        hostingView = NSHostingView(rootView: CuePanelView(completions: [], selectedIndex: 0))
        panel.contentView = hostingView
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
    }

    func show(_ completions: [Completion], metadata: RequestMetadata) {
        guard !completions.isEmpty,
              NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.apple.Terminal" else {
            panel.orderOut(nil)
            return
        }

        let visible = Array(completions.prefix(7))
        hostingView.rootView = CuePanelView(completions: visible, selectedIndex: 0)
        hostingView.layoutSubtreeIfNeeded()
        let size = hostingView.fittingSize
        panel.setContentSize(NSSize(width: max(410, size.width), height: size.height))
        if let origin = popupOrigin(metadata: metadata, panelSize: panel.frame.size) {
            panel.setFrameOrigin(origin)
        }
        panel.orderFrontRegardless()
    }

    func hide() {
        panel.orderOut(nil)
    }

    private func popupOrigin(metadata: RequestMetadata, panelSize: NSSize) -> NSPoint? {
        let app = AXUIElementCreateApplication(NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0)
        var windowValue: CFTypeRef?
        var windowElements: [AXUIElement] = []
        if AXUIElementCopyAttributeValue(app, kAXFocusedWindowAttribute as CFString, &windowValue) == .success,
           let windowValue {
            windowElements.append(unsafeBitCast(windowValue, to: AXUIElement.self))
        }
        var windowsValue: CFTypeRef?
        if AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &windowsValue) == .success,
           let windows = windowsValue as? [AXUIElement] {
            windowElements.append(contentsOf: windows)
        }
        let windowElement = windowElements.first(where: { element in
            guard let rect = axRect(element) else { return false }
            return rect.width > 200 && rect.height > 100 && rect.origin.x.isFinite && rect.origin.y.isFinite
        }) ?? windowElements.first
        let measuredWindowRect = windowElement.flatMap(axRect)
        let windowRect = measuredWindowRect.flatMap { rect in
            rect.width > 200 && rect.height > 100 && rect.origin.x.isFinite && rect.origin.y.isFinite ? rect : nil
        }

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

        let screen = NSScreen.main ?? NSScreen.screens.first
        let screenHeight = screen?.frame.height ?? 900
        let columns = max(1, metadata.columns)
        let lines = max(1, metadata.lines)
        let absoluteColumn = max(0, metadata.promptWidth + metadata.cursor)
        let fallbackRow = min(lines - 1, max(0, lines / 2))
        let column = absoluteColumn % columns
        var x: CGFloat
        var y: CGFloat
        if let focusedElement, let caret = axCaretRect(focusedElement),
           caret.width < 8, caret.height > 4, caret.origin.x.isFinite, caret.origin.y.isFinite,
           windowRect.map({ $0.insetBy(dx: -24, dy: -24).contains(CGPoint(x: caret.minX, y: caret.midY)) }) ?? true {
            x = caret.minX
            y = screenHeight - caret.maxY - panelSize.height - 3
        } else if let windowRect {
            // Terminal doesn't expose caret bounds on every macOS release. Its
            // active input line is generally near the bottom of the content area.
            let textRect = textRect ?? windowRect.insetBy(dx: 12, dy: 34)
            let cellWidth = textRect.width / CGFloat(columns)
            let cellHeight = textRect.height / CGFloat(lines)
            x = textRect.minX + CGFloat(column) * cellWidth
            let axY = textRect.minY + CGFloat(fallbackRow + 1) * cellHeight + 3
            y = screenHeight - axY - panelSize.height
        } else {
            let visible = screen?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1200, height: 800)
            let estimatedColumn = CGFloat(absoluteColumn) * 8.5
            x = min(visible.maxX - panelSize.width - 12, visible.minX + 18 + estimatedColumn)
            y = visible.minY + 110
        }
        if let windowRect {
            let rightEdge = windowRect.maxX - 12
            if x + panelSize.width > rightEdge { x = max(windowRect.minX + 12, rightEdge - panelSize.width) }
            if y < 12 { y = max(12, screenHeight - windowRect.maxY + 44) }
        }
        return NSPoint(x: x, y: y)
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

    private var selected: Completion? {
        guard completions.indices.contains(selectedIndex) else { return nil }
        return completions[selectedIndex]
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(completions.enumerated()), id: \.element.id) { index, completion in
                HStack(spacing: 10) {
                    CueIcon(icon: completion.icon, kind: completion.kind)
                        .frame(width: 22, height: 22)
                    Text(completion.name)
                        .font(.system(size: 14, weight: index == selectedIndex ? .semibold : .regular, design: .monospaced))
                        .lineLimit(1)
                    Spacer(minLength: 10)
                    if let description = completion.description, index != selectedIndex {
                        Text(description)
                            .font(.system(size: 12))
                            .foregroundStyle(Color(red: 0.78, green: 0.78, blue: 0.80))
                            .lineLimit(1)
                    }
                }
                .padding(.horizontal, 9)
                .frame(height: 31)
                .foregroundStyle(Color.white)
                .background(index == selectedIndex ? Color(red: 0.18, green: 0.39, blue: 0.82) : Color.clear, in: RoundedRectangle(cornerRadius: 5))
            }
            Divider().padding(.top, 3)
            HStack {
                Text(selected?.description ?? "Suggestions")
                    .font(.system(size: 12).italic())
                    .foregroundStyle(Color(red: 0.78, green: 0.78, blue: 0.80))
                    .lineLimit(1)
                Spacer()
                Text("Enter to complete")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(Color(red: 0.70, green: 0.70, blue: 0.72))
            }
            .padding(.horizontal, 9)
            .frame(height: 28)
        }
        .padding(6)
        .frame(width: 460)
        .background(Color(red: 0.18, green: 0.18, blue: 0.19), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(red: 0.27, green: 0.27, blue: 0.28), lineWidth: 1))
    }
}

struct CueIcon: View {
    let icon: String?
    let kind: String

    var body: some View {
        if let icon, !icon.hasPrefix("fig://") {
            Text(icon).font(.system(size: 18))
        } else if let image = figImage(icon) {
            Image(nsImage: image).resizable().scaledToFit().padding(1)
        } else {
            let type = iconType(icon)
            let style = iconStyle(type: type, kind: kind)
            RoundedRectangle(cornerRadius: 6)
                .fill(style.color)
                .overlay(Image(systemName: style.symbol).font(.system(size: 12, weight: .bold)).foregroundStyle(.white))
        }
    }

    private func iconType(_ value: String?) -> String {
        guard let value, let components = URLComponents(string: value),
              let type = components.queryItems?.first(where: { $0.name == "type" })?.value else { return "" }
        return type
    }

    private func figImage(_ value: String?) -> NSImage? {
        let type = iconType(value)
        guard !type.isEmpty else { return nil }
        for ext in ["png", "svg"] {
            let url = Bundle.main.bundleURL
                .appendingPathComponent("Contents/Resources/FigIcons", isDirectory: true)
                .appendingPathComponent("\(type).\(ext)")
            if let image = NSImage(contentsOf: url) { return image }
        }
        return nil
    }

    private func iconStyle(type: String, kind: String) -> (symbol: String, color: Color) {
        switch type {
        case "git": return ("arrow.branch", Color(red: 0.93, green: 0.32, blue: 0.22))
        case "node", "package": return ("shippingbox.fill", Color(red: 0.83, green: 0.37, blue: 0.25))
        case "option", "question": return ("questionmark", Color(red: 0.30, green: 0.70, blue: 0.38))
        case "file", "folder": return ("doc.fill", Color(red: 0.35, green: 0.55, blue: 0.83))
        default:
            if kind == "command" { return ("dollarsign", Color(red: 0.56, green: 0.28, blue: 0.78)) }
            if kind == "option" { return ("questionmark", Color(red: 0.30, green: 0.70, blue: 0.38)) }
            return ("terminal.fill", Color(red: 0.35, green: 0.45, blue: 0.62))
        }
    }
}

final class CueService {
    private let model: CueModel
    private let panelController: CuePanelController
    private let engineQueue = DispatchQueue(label: "cue.engine")
    private var process: Process?
    private var workerInput: FileHandle?
    private var outputBuffer = Data()
    private var nextID = 0
    private var latestID = 0
    private var inFlightID: Int?
    private var latestRequest: (id: Int, metadata: RequestMetadata)?
    private var pendingMetadata: [Int: RequestMetadata] = [:]
    private let socketPath = "/tmp/cue-\(getuid()).sock"
    private var visibilityTimer: Timer?
    private var activationObserver: NSObjectProtocol?

    init(model: CueModel, panelController: CuePanelController) {
        self.model = model
        self.panelController = panelController
    }

    func start() {
        startWorker()
        startSocket()
        startVisibilityMonitor()
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
            self.visibilityTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
                guard let self else { return }
                guard NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.apple.Terminal" else {
                    self.panelController.hide()
                    return
                }
                let terminal = AXUIElementCreateApplication(NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0)
                var focusedWindow: CFTypeRef?
                if AXUIElementCopyAttributeValue(terminal, kAXFocusedWindowAttribute as CFString, &focusedWindow) != .success || focusedWindow == nil {
                    self.panelController.hide()
                }
            }
        }
    }

    private func startWorker() {
        guard let home = Bundle.main.infoDictionary?["CueProjectPath"] as? String else { return }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["node", "\(home)/dist/worker.js"]
        process.environment = ["PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin", "NODE_PATH": "\(home)/node_modules"]
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
        let bound = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(server, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard bound == 0, listen(server, 16) == 0 else { close(server); return }
        chmod(socketPath, mode_t(0o600))
        DispatchQueue.global(qos: .userInteractive).async { [weak self] in
            while let self {
                let client = accept(server, nil, nil)
                if client < 0 { continue }
                let packet = Self.readAll(from: client)
                close(client)
                if let packet, let metadata = Self.parse(packet) { self.submit(metadata) }
            }
        }
    }

    private static func readAll(from fd: Int32) -> Data? {
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 8192)
        while true {
            let count = recv(fd, &buffer, buffer.count, 0)
            if count <= 0 { break }
            data.append(contentsOf: buffer[0..<count])
        }
        return data.isEmpty ? nil : data
    }

    private static func parse(_ data: Data) -> RequestMetadata? {
        let bytes = [UInt8](data)
        guard let separator = bytes.firstIndex(of: 0),
              let header = String(bytes: bytes[..<separator], encoding: .utf8),
              let line = String(bytes: bytes[(separator + 1)...], encoding: .utf8) else { return nil }
        let fields = header.split(separator: "\t", maxSplits: 4, omittingEmptySubsequences: false)
        guard fields.count == 5,
              let cursor = Int(fields[0]), let columns = Int(fields[1]),
              let lines = Int(fields[2]), let promptWidth = Int(fields[3]) else { return nil }
        return RequestMetadata(cursor: cursor, columns: columns, lines: lines, promptWidth: promptWidth, cwd: String(fields[4]), line: line)
    }

    private func submit(_ metadata: RequestMetadata) {
        engineQueue.async { [weak self] in
            guard let self else { return }
            self.nextID += 1
            let requestID = self.nextID
            self.latestID = requestID
            self.latestRequest = (requestID, metadata)
            if self.inFlightID == nil { self.sendLatestRequest() }
        }
    }

    private func sendLatestRequest() {
        guard let request = latestRequest, let workerInput else { return }
        let body: [String: Any] = ["id": request.id, "line": request.metadata.line, "cwd": request.metadata.cwd]
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
                if response.id == self.latestID, let metadata {
                    DispatchQueue.main.async {
                        self.model.completions = response.completions
                        self.model.selectedIndex = 0
                        if response.completions.isEmpty { self.panelController.hide() }
                        else { self.panelController.show(response.completions, metadata: metadata) }
                    }
                }
                if self.latestRequest != nil { self.sendLatestRequest() }
            }
        }
    }
}
