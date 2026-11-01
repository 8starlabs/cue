# Cue's first zsh bridge. Source this after compinit and other completion plugins.

cue_complete_widget() {
  local engine="${CUE_HOME:-$HOME/Applications/Cue}/dist/cli.js"
  if [[ ! -f "$engine" ]]; then
    zle expand-or-complete
    return
  fi

  local -a matches descriptions
  local name description
  while IFS= read -r -d '' name && IFS= read -r -d '' description; do
    matches+=("$name")
    descriptions+=("$description")
  done < <(CUE_CWD="$PWD" node "$engine" --zsh "$BUFFER" 2>/dev/null)

  if (( ${#matches} )); then
    compadd -Q -U -l -d descriptions -- "${matches[@]}" && return
  fi
  zle expand-or-complete
}

zle -N cue_complete_widget
bindkey '^I' cue_complete_widget
