# Cue's zsh bridge. Source this after compinit and other completion plugins.

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

typeset -g CUE_LIVE_LAST_BUFFER=''
typeset -g CUE_LIVE_LAST_CURSOR=''

_cue_live_watch() {
  if [[ "$BUFFER" == "$CUE_LIVE_LAST_BUFFER" && "$CURSOR" == "$CUE_LIVE_LAST_CURSOR" ]]; then
    return
  fi
  CUE_LIVE_LAST_BUFFER="$BUFFER"
  CUE_LIVE_LAST_CURSOR="$CURSOR"

  if (( CURSOR != ${#BUFFER} )) || [[ "$BUFFER" != *[[:space:]]* || "$BUFFER" == *[[:space:]] ]]; then
    zle -M ''
    return
  fi

  local engine="${CUE_HOME:-$HOME/Applications/Cue}/dist/cli.js"
  [[ -f "$engine" ]] || return
  local -a names
  local name description
  while IFS= read -r -d '' name; do
    IFS= read -r -d '' description || break
    names+=("$name")
  done < <(CUE_CWD="$PWD" node "$engine" --zsh "$BUFFER" 2>/dev/null)

  if (( ${#names} )); then
    zle -M "Cue: ${(j:   :)names[1,5]}"
  else
    zle -M ''
  fi
}

autoload -Uz add-zle-hook-widget
add-zle-hook-widget zle-line-pre-redraw _cue_live_watch
