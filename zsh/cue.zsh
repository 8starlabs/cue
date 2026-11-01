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

typeset -gi CUE_SELECTED_INDEX=0
typeset -ga CUE_MATCHES

_cue_matches() {
  local engine="${CUE_HOME}/dist/cli.js"
  local name description
  CUE_MATCHES=()
  [[ -f "$engine" ]] || return 1
  while IFS= read -r -d '' name && IFS= read -r -d '' description; do
    CUE_MATCHES+=("$name")
    (( ${#CUE_MATCHES} >= 7 )) && break
  done < <(CUE_CWD="$PWD" node "$engine" --zsh "$BUFFER" 2>/dev/null)
  (( ${#CUE_MATCHES} > 0 ))
}

_cue_send_selection() {
  [[ -S "$CUE_SOCKET" ]] || return
  { printf '%s\t%s\t%s\t%s\t%s\tselect:%s\0%s' "$CURSOR" "$COLUMNS" "$LINES" "$CUE_PROMPT_WIDTH" "$PWD" "$CUE_SELECTED_INDEX" "$BUFFER" | /usr/bin/nc -U "$CUE_SOCKET" >/dev/null 2>&1 } &!
}

_cue_move_selection() {
  local direction="$1"
  if [[ "$BUFFER" == *[[:space:]]* ]] && _cue_matches; then
    if [[ "$direction" == down ]]; then
      CUE_SELECTED_INDEX=$(( (CUE_SELECTED_INDEX + 1) % ${#CUE_MATCHES} ))
    else
      CUE_SELECTED_INDEX=$(( (CUE_SELECTED_INDEX + ${#CUE_MATCHES} - 1) % ${#CUE_MATCHES} ))
    fi
    _cue_send_selection
    return
  fi
  if [[ "$direction" == down ]]; then
    zle .down-line-or-history
  else
    zle .up-line-or-history
  fi
}

_cue_down_widget() { _cue_move_selection down }
_cue_up_widget() { _cue_move_selection up }
zle -N cue_down_widget _cue_down_widget
zle -N cue_up_widget _cue_up_widget
bindkey '^[[B' cue_down_widget
bindkey '^[[A' cue_up_widget
bindkey '^[OB' cue_down_widget
bindkey '^[OA' cue_up_widget

# Enter accepts the first live suggestion when the cursor is at the end of a
# command word. A second Enter runs the completed command as usual.
_cue_accept_widget() {
  local engine="${CUE_HOME:-$HOME/Applications/Cue}/dist/cli.js"
  if [[ -f "$engine" && "$BUFFER" == *[[:space:]]* ]]; then
    local selected
    local -a matches
    local name description
    while IFS= read -r -d '' name && IFS= read -r -d '' description; do
      matches+=("$name")
      (( ${#matches} >= 7 )) && break
    done < <(CUE_CWD="$PWD" node "$engine" --zsh "$BUFFER" 2>/dev/null)
    if (( CUE_SELECTED_INDEX >= ${#matches} )); then CUE_SELECTED_INDEX=0; fi
    selected="${matches[$(( CUE_SELECTED_INDEX + 1 ))]}"
    if [[ -n "$selected" ]]; then
      local current="${LBUFFER##*[[:space:]]}"
      local prefix="${LBUFFER[1,$(( ${#LBUFFER} - ${#current} ))]}"
      local trailing="${RBUFFER}"
      BUFFER="${prefix}${selected}${trailing}"
      CURSOR=$((${#prefix} + ${#selected}))
      CUE_SELECTED_INDEX=0
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
  if [[ "$BUFFER" != "$CUE_LIVE_LAST_BUFFER" ]]; then
    CUE_SELECTED_INDEX=0
  fi
  CUE_LIVE_LAST_BUFFER="$BUFFER"
  CUE_LIVE_LAST_CURSOR="$CURSOR"

  [[ -S "$CUE_SOCKET" ]] || return
  local line="$BUFFER"
  if (( CURSOR != ${#BUFFER} )); then
    line=''
  fi
  { printf '%s\t%s\t%s\t%s\t%s\t\0%s' "$CURSOR" "$COLUMNS" "$LINES" "$CUE_PROMPT_WIDTH" "$PWD" "$line" | /usr/bin/nc -U "$CUE_SOCKET" >/dev/null 2>&1 } &!
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
