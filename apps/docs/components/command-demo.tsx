'use client';

import { useRef, useState } from 'react';
import { ChevronDown, CornerDownLeft, FolderGit2, GitBranch, Sparkles } from 'lucide-react';

const suggestions = [
  { command: 'checkout', hint: '[branch, file, tag or commit]', description: 'Switch branches or restore working tree files', icon: GitBranch },
  { command: 'cherry-pick', hint: '<commit>', description: 'Apply the changes introduced by an existing commit', icon: GitBranch },
  { command: 'commit', hint: '-m "message"', description: 'Record changes to the repository', icon: Sparkles },
];

const closeDuration = 150;

export function CommandDemo() {
  const [open, setOpen] = useState(true);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = suggestions[0];

  function openDropdown() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    requestAnimationFrame(() => setOpen(true));
  }

  function closeDropdown() {
    setOpen(false);
    setClosing(true);
    closeTimer.current = setTimeout(() => setClosing(false), closeDuration);
  }

  const toggle = open ? closeDropdown : openDropdown;

  return (
    <div className="terminal-demo">
      <div className="terminal-titlebar">
        <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
        <div className="terminal-title"><FolderGit2 size={13} /> cue-playground — zsh</div>
        <span className="terminal-size">80 × 24</span>
        <button className="demo-toggle" onClick={toggle} aria-expanded={open} aria-controls="cue-demo-suggestions" aria-label={open ? 'Hide command suggestions' : 'Show command suggestions'}>
          <span>{open ? 'Hide' : 'Show'}</span><span className={`toggle-indicator ${open ? 'is-on' : ''}`} />
        </button>
      </div>
      <div className="terminal-screen">
        <div className="terminal-path">~/work/project</div>
        <div className="terminal-line"><span className="terminal-user">dev</span><span className="terminal-at">@</span><span className="terminal-host">terminal</span><span className="terminal-prompt"> % </span><span>git ch</span><span className="terminal-caret" aria-hidden="true" /></div>
        <div className="suggestion-anchor">
          <div id="cue-demo-suggestions" className={`t-dropdown suggestion-menu ${open ? 'is-open' : ''} ${closing ? 'is-closing' : ''}`} data-origin="top-left" role="listbox" aria-label="Git command suggestions" aria-hidden={!open}>
            {suggestions.map(({ command, hint, icon: Icon }, index) => (
              <div className={`suggestion-row ${index === 0 ? 'is-selected' : ''}`} key={command} role="option" aria-selected={index === 0}>
                <Icon size={13} strokeWidth={2.1} />
                <span className="suggestion-name"><b>{command.slice(0, 2)}</b>{command.slice(2)}</span>
                <span className="suggestion-hint">{hint}</span>
              </div>
            ))}
            <div className="suggestion-footer"><span>↑ ↓ navigate</span><span><CornerDownLeft size={11} /> insert</span></div>
          </div>
          <div className={`suggestion-description ${open ? 'is-visible' : ''}`} aria-hidden={!open}>
            <span className="description-kicker">COMMAND</span>
            <strong>{selected.command}</strong>
            <p>{selected.description}</p>
          </div>
        </div>
        <div className="demo-bottomline"><span><span className="green-dot" /> ready</span><span>Apple Terminal <ChevronDown size={11} /></span></div>
      </div>
    </div>
  );
}
