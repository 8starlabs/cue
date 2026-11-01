class Cue < Formula
  desc "IDE-style command suggestions for Apple Terminal"
  homepage "https://github.com/8starlabs/cue"
  url "https://github.com/8starlabs/cue/releases/download/v0.1.0/cue-0.1.0-macos-arm64.tar.gz"
  version "0.1.0"
  sha256 "b8d00d6fcbcc79fb3a8acfa6c3183d4b5abd0e43b16bd52b3e89b26ce19eecfa"

  depends_on macos: :ventura
  depends_on arch: :arm64
  depends_on "node"

  def install
    prefix.install "Cue.app"
    (share/"cue").install "dist", "node_modules", "zsh"
    (share/"cue"/"build").mkpath
    ln_sf prefix/"Cue.app", share/"cue"/"build"/"Cue.app"
  end

  def caveats
    <<~EOS
      Enable Cue in zsh by adding this line to ~/.zshrc:

        source "#{opt_prefix}/share/cue/zsh/cue.zsh"

      Open a new Apple Terminal window after saving the file.
    EOS
  end
end
