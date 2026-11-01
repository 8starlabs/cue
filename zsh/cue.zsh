# Cue's zsh bridge. Source this after compinit and other completion plugins.

# Resolve the project from this file so widgets keep working in fresh shells.
typeset -g CUE_HOME="${CUE_HOME:-${${(%):-%N}:A:h:h}}"

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

# Enter accepts the first live suggestion when the cursor is at the end of a
# command word. A second Enter runs the completed command as usual.
_cue_accept_widget() {
  local engine="${CUE_HOME:-$HOME/Applications/Cue}/dist/cli.js"
  if [[ -f "$engine" && "$BUFFER" == *[[:space:]]* ]]; then
    local selected description
    IFS= read -r -d '' selected < <(CUE_CWD="$PWD" node "$engine" --zsh "$BUFFER" 2>/dev/null)
    if [[ -n "$selected" ]]; then
      local current="${LBUFFER##*[[:space:]]}"
      local prefix="${LBUFFER[1,$(( ${#LBUFFER} - ${#current} ))]}"
      local trailing="${RBUFFER}"
      BUFFER="${prefix}${selected}${trailing}"
      CURSOR=$((${#prefix} + ${#selected}))
      zle -M ''
      return
    fi
  fi
  zle .accept-line
}
zle -N cue_accept_widget _cue_accept_widget
bindkey '^M' cue_accept_widget

typeset -g CUE_LIVE_LAST_BUFFER=''
typeset -g CUE_LIVE_LAST_CURSOR=''
typeset -gi CUE_PROMPT_WIDTH=0
typeset -g CUE_SOCKET="/tmp/cue-${UID}.sock"

_cue_live_watch() {
  if [[ "$BUFFER" == "$CUE_LIVE_LAST_BUFFER" && "$CURSOR" == "$CUE_LIVE_LAST_CURSOR" ]]; then
    return
  fi
  CUE_LIVE_LAST_BUFFER="$BUFFER"
  CUE_LIVE_LAST_CURSOR="$CURSOR"

  [[ -S "$CUE_SOCKET" ]] || return
  local line="$BUFFER"
  if (( CURSOR != ${#BUFFER} )); then
    line=''
  fi
  { printf '%s\t%s\t%s\t%s\t%s\0%s' "$CURSOR" "$COLUMNS" "$LINES" "$CUE_PROMPT_WIDTH" "$PWD" "$line" | /usr/bin/nc -U "$CUE_SOCKET" >/dev/null 2>&1 } &!
}

_cue_measure_prompt() {
  local rendered
  rendered="$(print -P -- "$PROMPT" | sed $'s/\033\\[[0-9;]*[[:alpha:]]//g')"
  CUE_PROMPT_WIDTH=${#rendered}
}
_cue_measure_prompt

autoload -Uz add-zle-hook-widget
autoload -Uz add-zsh-hook
add-zle-hook-widget zle-line-pre-redraw _cue_live_watch
add-zsh-hook precmd _cue_measure_prompt

if [[ -d "${CUE_HOME:-$HOME/Applications/Cue}/build/Cue.app" ]]; then
  /usr/bin/open -ga "${CUE_HOME:-$HOME/Applications/Cue}/build/Cue.app" >/dev/null 2>&1
fi
