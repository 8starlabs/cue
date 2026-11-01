# Cue's zsh bridge. Source this after compinit and other completion plugins.

# Resolve the project from this file so widgets keep working in fresh shells.
typeset -g CUE_HOME="${CUE_HOME:-${${(%):-%N}:A:h:h}}"
# Older setup instructions exported the repository root as CUE_HOME. In the
# monorepo, the runtime and app bundle live under packages/cue instead.
if [[ -d "${CUE_HOME}/packages/cue" && -f "${CUE_HOME}/packages/cue/package.json" ]]; then
  CUE_HOME="${CUE_HOME}/packages/cue"
fi

typeset -gi CUE_SELECTED_INDEX=0
typeset -ga CUE_MATCHES
typeset -gi CUE_CURSOR_ROW=0
typeset -gi CUE_CURSOR_COLUMN=0
typeset -gi CUE_SUPPRESS_UNTIL_SPACE=0
typeset -g CUE_DISMISSED_BUFFER=''
typeset -g CUE_ACCEPTED_BUFFER=''

_cue_query_terminal_cursor() {
  local cursor_delta="${1:-0}"
  local response=''
  print -rn -- $'\e[6n' > /dev/tty
  if IFS= read -r -s -d 'R' response < /dev/tty; then
    if [[ "$response" == *$'\e['* ]]; then
      local typed="${response%$'\e['*}"
      response="${response##*$'\e['}"
      [[ -n "$typed" ]] && zle -U "$typed"
      local row="${response%%;*}"
      local column="${response#*;}"
      if [[ "$row" == <-> && "$column" == <-> ]]; then
        (( column += cursor_delta ))
        while (( column < 1 )); do (( column += COLUMNS, row -= 1 )); done
        while (( column > COLUMNS )); do (( column -= COLUMNS, row += 1 )); done
        (( row < 1 )) && row=1
        CUE_CURSOR_ROW="$row"
        CUE_CURSOR_COLUMN="$column"
      else
        zle -U "${response}R"
      fi
    else
      zle -U "${response}R"
    fi
  elif [[ -n "$response" ]]; then
    zle -U "$response"
  fi
}

_cue_matches() {
  local engine="${CUE_HOME}/dist/cli.js"
  local name description
  CUE_MATCHES=()
  [[ -f "$engine" ]] || return 1
  while IFS= read -r -d '' name && IFS= read -r -d '' description; do
    CUE_MATCHES+=("$name")
  done < <(CUE_CWD="$PWD" node "$engine" --zsh "$BUFFER" 2>/dev/null)
  (( ${#CUE_MATCHES} > 0 ))
}

_cue_send_selection() {
  [[ -S "$CUE_SOCKET" ]] || return
  { printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\tselect:%s\0%s' "$CURSOR" "$COLUMNS" "$LINES" "$CUE_PROMPT_WIDTH" "$CUE_CURSOR_ROW" "$CUE_CURSOR_COLUMN" "$PWD" "$CUE_SELECTED_INDEX" "$BUFFER" | /usr/bin/nc -U "$CUE_SOCKET" >/dev/null 2>&1 } &!
}

_cue_send_hide() {
  if [[ -S "$CUE_SOCKET" ]]; then
    { printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\thide\0%s' "$CURSOR" "$COLUMNS" "$LINES" "$CUE_PROMPT_WIDTH" "$CUE_CURSOR_ROW" "$CUE_CURSOR_COLUMN" "$PWD" "$BUFFER" | /usr/bin/nc -U "$CUE_SOCKET" >/dev/null 2>&1 } &!
  fi
}

_cue_dismiss_widget() {
  CUE_DISMISSED_BUFFER="$BUFFER"
  _cue_send_hide
  zle -M ''
}
zle -N cue_dismiss_widget _cue_dismiss_widget
bindkey '^[' cue_dismiss_widget

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

# Insert the highlighted Cue suggestion without invoking zsh's printed
# completion list. Return nonzero when there is no suggestion to insert.
_cue_complete_selection() {
  (( CURSOR == ${#BUFFER} )) || return 1
  [[ "$BUFFER" != "$CUE_DISMISSED_BUFFER" ]] || return 1
  local engine="${CUE_HOME:-$HOME/Applications/Cue}/dist/cli.js"
  [[ -f "$engine" && "$BUFFER" == *[[:space:]]* ]] || return 1
  local selected
  local -a matches
  local name description
  while IFS= read -r -d '' name && IFS= read -r -d '' description; do
    matches+=("$name")
  done < <(CUE_CWD="$PWD" node "$engine" --zsh "$BUFFER" 2>/dev/null)
  (( CUE_SELECTED_INDEX >= ${#matches} )) && CUE_SELECTED_INDEX=0
  selected="${matches[$(( CUE_SELECTED_INDEX + 1 ))]}"
  [[ -n "$selected" ]] || return 1

  local current="${LBUFFER##*[[:space:]]}"
  local prefix="${LBUFFER[1,$(( ${#LBUFFER} - ${#current} ))]}"
  local trailing="${RBUFFER}"
  BUFFER="${prefix}${selected}${trailing}"
  CURSOR=$((${#prefix} + ${#selected}))
  CUE_SELECTED_INDEX=0
  if [[ "$BUFFER" == cd[[:space:]]* || "$selected" == */ ]]; then
    # Directory suggestions can reveal another useful layer; let Enter accept
    # the next suggestion until the user finishes the argument with a space.
    CUE_ACCEPTED_BUFFER=''
  else
    CUE_ACCEPTED_BUFFER="$BUFFER"
  fi
  # Keep the popup live after a directory completion; hide other suggestions
  # until the next argument is started.
  if [[ "$BUFFER" == cd[[:space:]]* ]]; then
    CUE_SUPPRESS_UNTIL_SPACE=0
  else
    CUE_SUPPRESS_UNTIL_SPACE=1
  fi
  zle -M ''
  return 0
}

_cue_tab_widget() { _cue_complete_selection }
zle -N cue_tab_widget _cue_tab_widget
bindkey '^I' cue_tab_widget

_cue_accept_widget() {
  if [[ -n "$CUE_ACCEPTED_BUFFER" && "$BUFFER" == "$CUE_ACCEPTED_BUFFER" ]]; then
    CUE_ACCEPTED_BUFFER=''
    CUE_DISMISSED_BUFFER="$BUFFER"
    _cue_send_hide
    zle .accept-line
    return
  fi
  if _cue_complete_selection; then
    return
  fi
  CUE_DISMISSED_BUFFER="$BUFFER"
  _cue_send_hide
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
  local old_cursor="${CUE_LIVE_LAST_CURSOR:-0}"
  if [[ "$BUFFER" != "$CUE_LIVE_LAST_BUFFER" ]]; then
    CUE_SELECTED_INDEX=0
    CUE_DISMISSED_BUFFER=''
    [[ "$BUFFER" == "$CUE_ACCEPTED_BUFFER" ]] || CUE_ACCEPTED_BUFFER=''
  fi
  CUE_LIVE_LAST_BUFFER="$BUFFER"
  CUE_LIVE_LAST_CURSOR="$CURSOR"

  [[ -S "$CUE_SOCKET" ]] || return
  local line="$BUFFER"
  if (( CUE_SUPPRESS_UNTIL_SPACE )); then
    if (( CURSOR == ${#BUFFER} )) && [[ "$BUFFER" == *[[:space:]] ]]; then
      CUE_SUPPRESS_UNTIL_SPACE=0
    else
      line=''
    fi
  fi
  if (( CURSOR != ${#BUFFER} )); then
    line=''
  elif [[ -n "$line" ]]; then
    _cue_query_terminal_cursor "$(( CURSOR - old_cursor ))"
  else
    CUE_CURSOR_ROW=0
    CUE_CURSOR_COLUMN=0
  fi
  { printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t\0%s' "$CURSOR" "$COLUMNS" "$LINES" "$CUE_PROMPT_WIDTH" "$CUE_CURSOR_ROW" "$CUE_CURSOR_COLUMN" "$PWD" "$line" | /usr/bin/nc -U "$CUE_SOCKET" >/dev/null 2>&1 } &!
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
