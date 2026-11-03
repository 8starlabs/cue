# Cue's zsh bridge. Source this after compinit and other completion plugins.

# Resolve the project from this file so widgets keep working in fresh shells.
typeset -g CUE_HOME="${CUE_HOME:-${${(%):-%N}:A:h:h}}"
# Older setup instructions exported the repository root as CUE_HOME. In the
# monorepo, the runtime and app bundle live under packages/cue instead.
if [[ -d "${CUE_HOME}/packages/cue" && -f "${CUE_HOME}/packages/cue/package.json" ]]; then
  CUE_HOME="${CUE_HOME}/packages/cue"
fi

# Escape is a prefix for arrow and Meta-key sequences in zsh. Keep the wait
# short for quick dismissal, but long enough to recognize Option-Backspace.
typeset -g KEYTIMEOUT=5

typeset -gi CUE_SELECTED_INDEX=0
typeset -g CUE_SELECTED_VALUE=''
typeset -g CUE_SELECTED_REPLACEMENT=''
typeset -g CUE_SELECTION_BUFFER=''
typeset -g CUE_SELECTION_CURSOR=''
typeset -ga CUE_MATCHES
typeset -ga CUE_REPLACEMENTS
typeset -g CUE_MATCHES_BUFFER=''
typeset -g CUE_MATCHES_CWD=''
typeset -g CUE_MATCHES_CURSOR=''
typeset -gi CUE_MATCHES_CACHE_VALID=0
typeset -gi CUE_CURSOR_ROW=0
typeset -gi CUE_CURSOR_COLUMN=0
typeset -gi CUE_SUPPRESS_UNTIL_SPACE=0
typeset -g CUE_DISMISSED_BUFFER=''
typeset -g CUE_ACCEPTED_BUFFER=''
typeset -g CUE_ENTER_DISMISS_BUFFER=''
if (( ${+CUE_SOCKET_FD} && CUE_SOCKET_FD >= 0 )); then
  exec {CUE_SOCKET_FD}>&- 2>/dev/null
fi
typeset -gi CUE_SOCKET_FD=-1
typeset -g CUE_SOCKET_INODE=''
zmodload zsh/net/socket 2>/dev/null || true
zmodload zsh/stat 2>/dev/null || true

_cue_query_terminal_cursor() {
  local cursor_delta="${1:-0}"
  local use_cached_position="${2:-0}"

  if (( use_cached_position && CUE_CURSOR_ROW > 0 && CUE_CURSOR_COLUMN > 0 )); then
    (( CUE_CURSOR_COLUMN += cursor_delta ))
    while (( CUE_CURSOR_COLUMN < 1 )); do (( CUE_CURSOR_COLUMN += COLUMNS, CUE_CURSOR_ROW -= 1 )); done
    while (( CUE_CURSOR_COLUMN > COLUMNS )); do (( CUE_CURSOR_COLUMN -= COLUMNS, CUE_CURSOR_ROW += 1 )); done
    (( CUE_CURSOR_ROW < 1 )) && CUE_CURSOR_ROW=1
    return
  fi

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
  if (( CUE_MATCHES_CACHE_VALID )) && [[ "$BUFFER" == "$CUE_MATCHES_BUFFER" && "$CURSOR" == "$CUE_MATCHES_CURSOR" && "$PWD" == "$CUE_MATCHES_CWD" ]]; then
    (( ${#CUE_MATCHES} > 0 ))
    return
  fi

  local engine="${CUE_HOME}/dist/cli.js"
  local name replacement description cached_line cached_cwd cache_matched=0
  local -a cached_matches=() cached_replacements=()
  CUE_MATCHES=()
  CUE_REPLACEMENTS=()
  if [[ -r "$CUE_SOCKET.cache" ]]; then
    {
      if IFS= read -r -d '' cached_line && IFS= read -r -d '' cached_cwd && [[ "$cached_line" == "$LBUFFER" && "$cached_cwd" == "$PWD" ]]; then
        cache_matched=1
        while IFS= read -r -d '' name && IFS= read -r -d '' replacement && IFS= read -r -d '' description; do
          cached_matches+=("$name")
          cached_replacements+=("$replacement")
        done
      fi
    } < "$CUE_SOCKET.cache"
  fi
  if (( cache_matched )); then
    CUE_MATCHES=("${cached_matches[@]}")
    CUE_REPLACEMENTS=("${cached_replacements[@]}")
  else
    [[ -f "$engine" ]] || return 1
    while IFS= read -r -d '' name && IFS= read -r -d '' replacement && IFS= read -r -d '' description; do
      CUE_MATCHES+=("$name")
      CUE_REPLACEMENTS+=("$replacement")
    done < <(CUE_CWD="$PWD" node "$engine" --zsh "$LBUFFER" 2>/dev/null)
  fi
  if [[ -n "$CUE_ENTER_DISMISS_BUFFER" && "$BUFFER" == "$CUE_ENTER_DISMISS_BUFFER" ]]; then
    if [[ "$BUFFER" == "code ." ]] && (( ${#CUE_MATCHES} > 0 )); then
      local -a ordered_matches=("${CUE_MATCHES[1]}" "__cue_enter_current_directory__")
      local -a ordered_replacements=("${CUE_REPLACEMENTS[1]}" '')
      if (( ${#CUE_MATCHES} > 1 )); then
        ordered_matches+=("${CUE_MATCHES[2,-1]}")
        ordered_replacements+=("${CUE_REPLACEMENTS[2,-1]}")
      fi
      CUE_MATCHES=("${ordered_matches[@]}")
      CUE_REPLACEMENTS=("${ordered_replacements[@]}")
    else
      CUE_MATCHES=("__cue_enter_current_directory__" "${CUE_MATCHES[@]}")
    fi
  fi
  CUE_MATCHES_BUFFER="$BUFFER"
  CUE_MATCHES_CWD="$PWD"
  CUE_MATCHES_CURSOR="$CURSOR"
  CUE_MATCHES_CACHE_VALID=1
  (( ${#CUE_MATCHES} > 0 ))
}

_cue_materialize_text() {
  local output="$1" text="$2" character
  for character in ${(s::)text}; do
    if [[ "$character" == $'\b' ]]; then
      (( ${#output} > 0 )) && output="${output[1,-2]}"
    else
      output+="$character"
    fi
  done
  REPLY="$output"
}

_cue_send_selection() {
  _cue_send_packet "select:$CUE_SELECTED_INDEX" "$BUFFER"
}

_cue_send_hide() {
  _cue_send_packet hide "$BUFFER"
}

_cue_connect_socket() {
  local -A socket_stat
  if (( CUE_SOCKET_FD >= 0 )); then
    if [[ -S "$CUE_SOCKET" ]] && zstat -H socket_stat "$CUE_SOCKET" 2>/dev/null && [[ "${socket_stat[inode]}" == "$CUE_SOCKET_INODE" ]]; then
      return 0
    fi
    _cue_close_socket
  fi
  [[ -S "$CUE_SOCKET" ]] || return 1
  zstat -H socket_stat "$CUE_SOCKET" 2>/dev/null || return 1
  zsocket "$CUE_SOCKET" 2>/dev/null || return 1
  CUE_SOCKET_FD=$REPLY
  CUE_SOCKET_INODE="${socket_stat[inode]}"
}

_cue_close_socket() {
  if (( CUE_SOCKET_FD >= 0 )); then
    exec {CUE_SOCKET_FD}>&- 2>/dev/null
    CUE_SOCKET_FD=-1
    CUE_SOCKET_INODE=''
  fi
}

_cue_write_packet() {
  local action="$1" line="$2" include_environment="${3:-0}"
  if (( include_environment )); then
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\0%s\0\0' "$CURSOR" "$COLUMNS" "$LINES" "$CUE_PROMPT_WIDTH" "$CUE_CURSOR_ROW" "$CUE_CURSOR_COLUMN" "$PWD" "$action" "$CUE_ENV_B64" "$line" >&$CUE_SOCKET_FD 2>/dev/null
  else
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\0%s\0\0' "$CURSOR" "$COLUMNS" "$LINES" "$CUE_PROMPT_WIDTH" "$CUE_CURSOR_ROW" "$CUE_CURSOR_COLUMN" "$PWD" "$action" "$line" >&$CUE_SOCKET_FD 2>/dev/null
  fi
}

_cue_send_packet() {
  local action="$1" line="$2" include_environment="${3:-0}"
  _cue_connect_socket || return 1
  if _cue_write_packet "$action" "$line" "$include_environment"; then
    return 0
  fi
  _cue_close_socket
  _cue_connect_socket || return 1
  _cue_write_packet "$action" "$line" "$include_environment"
}

_cue_dismiss_widget() {
  CUE_DISMISSED_BUFFER="$BUFFER"
  CUE_ENTER_DISMISS_BUFFER=''
  _cue_send_hide
  zle -M ''
}
zle -N cue_dismiss_widget _cue_dismiss_widget
bindkey '^[' cue_dismiss_widget
bindkey -M emacs '^[' cue_dismiss_widget
bindkey -M emacs '^[^?' backward-kill-word
bindkey -M emacs '^[^H' backward-kill-word
bindkey -M viins '^[' cue_dismiss_widget
bindkey -M viins '^[^?' backward-kill-word
bindkey -M viins '^[^H' backward-kill-word

_cue_move_selection() {
  local direction="$1"
  if _cue_matches; then
    if [[ "$direction" == down ]]; then
      CUE_SELECTED_INDEX=$(( (CUE_SELECTED_INDEX + 1) % ${#CUE_MATCHES} ))
    else
      CUE_SELECTED_INDEX=$(( (CUE_SELECTED_INDEX + ${#CUE_MATCHES} - 1) % ${#CUE_MATCHES} ))
    fi
    local selected_index=$(( CUE_SELECTED_INDEX + 1 ))
    CUE_SELECTED_VALUE="${CUE_MATCHES[$selected_index]}"
    CUE_SELECTED_REPLACEMENT="${CUE_REPLACEMENTS[$selected_index]}"
    CUE_SELECTION_BUFFER="$BUFFER"
    CUE_SELECTION_CURSOR="$CURSOR"
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
  [[ "$BUFFER" != "$CUE_DISMISSED_BUFFER" ]] || return 1
  local selected replacement
  if [[ "$BUFFER" == "$CUE_SELECTION_BUFFER" && "$CURSOR" == "$CUE_SELECTION_CURSOR" && -n "$CUE_SELECTED_VALUE" ]]; then
    selected="$CUE_SELECTED_VALUE"
    replacement="$CUE_SELECTED_REPLACEMENT"
  else
    _cue_matches || return 1
    (( CUE_SELECTED_INDEX >= ${#CUE_MATCHES} )) && CUE_SELECTED_INDEX=0
    local selected_index=$(( CUE_SELECTED_INDEX + 1 ))
    selected="${CUE_MATCHES[$selected_index]}"
    replacement="${CUE_REPLACEMENTS[$selected_index]}"
  fi
  [[ -n "$selected" ]] || return 1
  [[ "$selected" == "__cue_enter_current_directory__" ]] && return 1

  local insertion before_marker after_marker before_cursor cursor_position
  if [[ -n "$replacement" ]]; then
    insertion="$replacement"
    if [[ "$insertion" == *"{cursor}"* ]]; then
      before_marker="${insertion%%\{cursor\}*}"
      after_marker="${insertion#*\{cursor\}}"
      _cue_materialize_text '' "$before_marker"
      before_cursor="$REPLY"
      cursor_position=${#before_cursor}
      _cue_materialize_text "$before_cursor" "$after_marker"
      BUFFER="$REPLY"
      CURSOR=$(( cursor_position < ${#BUFFER} ? cursor_position : ${#BUFFER} ))
    else
      _cue_materialize_text '' "$insertion"
      BUFFER="$REPLY"
      CURSOR=${#BUFFER}
    fi
  else
    local current="${LBUFFER##*[[:space:]]}"
    local prefix="${LBUFFER[1,$(( ${#LBUFFER} - ${#current} ))]}"
    local suffixToken="${RBUFFER%%[[:space:]]*}"
    local trailing="${RBUFFER:${#suffixToken}}"
    insertion="$selected"
    if [[ "$insertion" == *"{cursor}"* ]]; then
      before_marker="${insertion%%\{cursor\}*}"
      after_marker="${insertion#*\{cursor\}}"
      _cue_materialize_text "$prefix" "$before_marker"
      before_cursor="$REPLY"
      cursor_position=${#before_cursor}
      _cue_materialize_text "$before_cursor" "$after_marker"
      BUFFER="${REPLY}${trailing}"
      CURSOR=$(( cursor_position < ${#REPLY} ? cursor_position : ${#REPLY} ))
    else
      _cue_materialize_text "$prefix" "$insertion"
      BUFFER="${REPLY}${trailing}"
      CURSOR=${#REPLY}
    fi
  fi
  CUE_SELECTED_INDEX=0
  if [[ "$BUFFER" == cd[[:space:]]* ]]; then
    # Keep the next path level visible after a folder is accepted. Enter can
    # dismiss that level; another Enter runs cd without editing the path.
    CUE_ACCEPTED_BUFFER=''
    CUE_ENTER_DISMISS_BUFFER="$BUFFER"
  elif [[ "$BUFFER" == "code ." ]]; then
    CUE_ACCEPTED_BUFFER="$BUFFER"
    CUE_ENTER_DISMISS_BUFFER="$BUFFER"
  else
    CUE_ACCEPTED_BUFFER="$BUFFER"
    CUE_ENTER_DISMISS_BUFFER=''
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
  if [[ -n "$CUE_ENTER_DISMISS_BUFFER" && "$BUFFER" == "$CUE_ENTER_DISMISS_BUFFER" && "$BUFFER" != "$CUE_DISMISSED_BUFFER" ]] && (( CUE_SELECTED_INDEX == 0 )) && _cue_matches; then
    _cue_dismiss_widget
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
bindkey '^J' cue_accept_widget
bindkey -M emacs '^M' cue_accept_widget
bindkey -M emacs '^J' cue_accept_widget
bindkey -M viins '^M' cue_accept_widget
bindkey -M viins '^J' cue_accept_widget

typeset -g CUE_LIVE_LAST_BUFFER=''
typeset -g CUE_LIVE_LAST_CURSOR=''
typeset -gi CUE_PROMPT_WIDTH=0
typeset -g CUE_ENV_B64=''
typeset -g CUE_SOCKET="/tmp/cue-${UID}.sock"

_cue_live_watch() {
  if [[ "$BUFFER" == "$CUE_LIVE_LAST_BUFFER" && "$CURSOR" == "$CUE_LIVE_LAST_CURSOR" ]]; then
    return
  fi
  local old_buffer="$CUE_LIVE_LAST_BUFFER"
  local old_cursor="${CUE_LIVE_LAST_CURSOR:-0}"
  if [[ "$BUFFER" != "$CUE_LIVE_LAST_BUFFER" ]]; then
    if [[ -n "$CUE_ACCEPTED_BUFFER" && "$BUFFER" != "$CUE_ACCEPTED_BUFFER"* ]]; then
      CUE_SUPPRESS_UNTIL_SPACE=0
    fi
    CUE_SELECTED_INDEX=0
    CUE_SELECTED_VALUE=''
    CUE_SELECTED_REPLACEMENT=''
    CUE_SELECTION_BUFFER=''
    CUE_SELECTION_CURSOR=''
    CUE_DISMISSED_BUFFER=''
    [[ "$BUFFER" == "$CUE_ACCEPTED_BUFFER" ]] || CUE_ACCEPTED_BUFFER=''
    [[ "$BUFFER" == "$CUE_ENTER_DISMISS_BUFFER" ]] || CUE_ENTER_DISMISS_BUFFER=''
  fi
  local action=''
  [[ -n "$CUE_ENTER_DISMISS_BUFFER" && "$BUFFER" == "$CUE_ENTER_DISMISS_BUFFER" ]] && action='selected'
  CUE_LIVE_LAST_BUFFER="$BUFFER"
  CUE_LIVE_LAST_CURSOR="$CURSOR"

  if [[ -n "$CUE_DISMISSED_BUFFER" && "$BUFFER" == "$CUE_DISMISSED_BUFFER" ]]; then
    _cue_send_hide
    return
  fi

  [[ -S "$CUE_SOCKET" ]] || return
  local line="$LBUFFER"
  if (( CUE_SUPPRESS_UNTIL_SPACE )); then
    if (( CURSOR == ${#BUFFER} )) && [[ "$BUFFER" == *[[:space:]] ]]; then
      CUE_SUPPRESS_UNTIL_SPACE=0
    else
      _cue_send_hide
      return
    fi
  fi
  if [[ -n "$line" ]]; then
    local cursor_delta=$(( CURSOR - old_cursor ))
    local use_cached_position=0
    if (( CUE_CURSOR_ROW > 0 && CUE_CURSOR_COLUMN > 0 )); then
      if [[ "$BUFFER" == "$old_buffer" ]] && (( cursor_delta >= -1 && cursor_delta <= 1 )); then
        use_cached_position=1
      elif [[ "$BUFFER" == "$old_buffer"* ]] && (( ${#BUFFER} == ${#old_buffer} + 1 )); then
        use_cached_position=1
      elif [[ "$old_buffer" == "$BUFFER"* ]] && (( ${#old_buffer} == ${#BUFFER} + 1 )); then
        use_cached_position=1
      fi
    fi
    _cue_query_terminal_cursor "$cursor_delta" "$use_cached_position"
  else
    CUE_CURSOR_ROW=0
    CUE_CURSOR_COLUMN=0
    _cue_send_hide
    return
  fi
  _cue_send_packet "$action" "$line" 1
}

_cue_measure_prompt() {
  local rendered
  rendered="$(print -P -- "$PROMPT" | sed $'s/\033\\[[0-9;]*[[:alpha:]]//g')"
  CUE_PROMPT_WIDTH=${#rendered}
  CUE_ENV_B64="$(/usr/bin/env -0 | /usr/bin/base64 | tr -d '\n')"
  CUE_CURSOR_ROW=0
  CUE_CURSOR_COLUMN=0
  CUE_SUPPRESS_UNTIL_SPACE=0
}
_cue_measure_prompt

autoload -Uz add-zle-hook-widget
autoload -Uz add-zsh-hook
add-zle-hook-widget zle-line-pre-redraw _cue_live_watch
add-zsh-hook precmd _cue_measure_prompt

if [[ -d "${CUE_HOME:-$HOME/Applications/Cue}/build/Cue.app" ]]; then
  /usr/bin/open -ga "${CUE_HOME:-$HOME/Applications/Cue}/build/Cue.app" >/dev/null 2>&1
fi
