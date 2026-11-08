class Cue < Formula
  desc "IDE-style suggestions for Apple Terminal and VS Code"
  homepage "https://github.com/8starlabs/cue"
  url "https://github.com/8starlabs/cue/releases/download/v0.1.9/cue-0.1.9-macos-arm64.tar.gz"
  version "0.1.9"
  sha256 "bbdc554d3723961ffde9c314f36349e6b50445890fd6f40a5a094e82520fc88a"

  depends_on macos: :ventura
  depends_on arch: :arm64
  depends_on "node"

  def install
    prefix.install "Cue.app"
    (share/"cue").install "dist", "zsh"
    (share/"cue"/"build").mkpath
    ln_sf prefix/"Cue.app", share/"cue"/"build"/"Cue.app"
    runtime_node_modules = prefix/"Cue.app"/"Contents"/"Resources"/"CueRuntime"/"node_modules"
    ln_sf runtime_node_modules, share/"cue"/"node_modules"
  end

  def caveats
    <<~EOS
      Enable Cue in zsh by adding this line to ~/.zshrc:

        source "#{opt_prefix}/share/cue/zsh/cue.zsh"

      Open a new zsh session in Apple Terminal or the VS Code integrated terminal.
      In VS Code, choose zsh with Terminal: Select Default Profile if needed.

      After setup, use cue-update from zsh to upgrade Cue and refresh the current
      shell. See the update guide for the first upgrade from an earlier release.
    EOS
  end
end
