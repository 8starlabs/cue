# Cue's first zsh bridge. Source this after compinit and other completion plugins.

_cue_completion() {
  local engine="${CUE_HOME:-$HOME/Applications/Cue}/dist/cli.js"
  if [[ ! -f "$engine" ]]; then
    return 1
  fi

  local -a matches descriptions
  local name description
  while IFS= read -r -d '' name && IFS= read -r -d '' description; do
    matches+=("$name")
    descriptions+=("$description")
  done < <(CUE_CWD="$PWD" node "$engine" --zsh "$BUFFER" 2>/dev/null)

  if (( ${#matches} )); then
    compadd -Q -U -l -d descriptions -- "${matches[@]}"
    return
  fi
  return 1
}

zmodload zsh/complist 2>/dev/null
zle -C cue_complete_widget menu-select _cue_completion
zstyle ':completion:cue_complete_widget:*' menu yes select=1
bindkey '^I' cue_complete_widget
