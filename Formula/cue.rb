class Cue < Formula
  desc "IDE-style suggestions for Apple Terminal and VS Code"
  homepage "https://github.com/8starlabs/cue"
  url "https://github.com/8starlabs/cue/releases/download/v0.1.7/cue-0.1.7-macos-arm64.tar.gz"
  version "0.1.7"
  sha256 "845b5ea1c22e6f2769f89a73e9c7c845fc41c8b39bbc2c7ac2cdac6b6462ae34"

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
    EOS
  end
end
