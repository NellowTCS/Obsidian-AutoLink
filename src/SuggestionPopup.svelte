<script lang="ts">
	import { onMount, onDestroy } from "svelte";

	export let matches: Array<{ title: string; file: any; isAlias: boolean }>;
	export let editor: any;
	export let typed: string;
	export let position: { left: number; top: number; bottom: number };
	export let allowEnterAccept: boolean = true;
	export let onAccept: (match: {
		title: string;
		file: any;
		isAlias: boolean;
	}) => void;
	export let onClose: () => void;

	let selected = 0;
	let popupEl: HTMLElement;
	let isActive = false;

	function accept() {
		if (matches.length > 0 && isActive) {
			onAccept(matches[selected]);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		// Only handle our keys if the popup is actually visible and active
		if (!popupEl || !document.body.contains(popupEl) || !isActive) return;

		// Check if the event target is the editor or related to our popup
		const target = event.target as HTMLElement;
		const isEditorEvent = target.closest('.cm-editor') || target.closest('.autolink-popup');
		
		if (!isEditorEvent) return;

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				selected = (selected + 1) % matches.length;
				scrollToSelected();
				break;
			case "ArrowUp":
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				selected = (selected - 1 + matches.length) % matches.length;
				scrollToSelected();
				break;
			case "Enter":
				// Only accept on Enter if allowed and not in conflicting context
				if (allowEnterAccept && !isObsidianUsingEnter()) {
					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation();
					accept();
				}
				break;
			case "Tab":
				// Only accept on Tab if Shift isn't pressed (Shift+Tab is for reverse navigation)
				if (!event.shiftKey && !isObsidianUsingTab()) {
					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation();
					accept();
				}
				break;
			case " ":
				// Space as alternative accept key (less likely to conflict)
				if (event.ctrlKey || event.metaKey) {
					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation();
					accept();
				}
				break;
			case "Escape":
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				onClose();
				break;
			// Add number keys for quick selection
			case "1":
			case "2":
			case "3":
			case "4":
			case "5":
			case "6":
			case "7":
			case "8":
			case "9":
				const num = parseInt(event.key) - 1;
				if (num < matches.length) {
					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation();
					selected = num;
					accept();
				}
				break;
		}
	}

	function isObsidianUsingEnter(): boolean {
		// More robust check for when Obsidian needs Enter
		const activeElement = document.activeElement;
		const selection = window.getSelection();
		
		// Don't intercept if there's selected text (Obsidian might format it)
		if (selection && selection.toString().length > 0) {
			return true;
		}
		
		// Don't intercept in certain input contexts unless we're sure it's safe
		if (activeElement) {
			if (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA") {
				return true;
			}
			
			// Check for CodeMirror editor context
			if (activeElement.classList.contains("cm-editor") || activeElement.closest('.cm-editor')) {
				// Allow Enter interception only if we're at the end of a line with our typed text
				try {
					const cursor = editor.getCursor();
					const line = editor.getLine(cursor.line);
					const beforeCursor = line.slice(0, cursor.ch);
					
					// Only allow if the last part of the line matches our typed text
					if (beforeCursor.endsWith(typed)) {
						return false; // Safe to intercept
					}
				} catch (e) {
					// If we can't determine context, err on the side of caution
					return true;
				}
			}
		}
		
		return false; // Default to allowing interception
	}

	function isObsidianUsingTab(): boolean {
		// Check if Tab would be used for indentation or navigation
		const activeElement = document.activeElement;
		const selection = window.getSelection();

		// Don't intercept if there's selected text (might be for indentation)
		if (selection && selection.toString().length > 0) {
			return true;
		}

		if (activeElement && (activeElement.classList.contains("cm-editor") || activeElement.closest('.cm-editor'))) {
			// Allow Tab interception in most cases, but be cautious with indentation contexts
			try {
				const cursor = editor.getCursor();
				const line = editor.getLine(cursor.line);
				
				// If we're at the beginning of a line, Tab might be for indentation
				if (cursor.ch === 0 || line.slice(0, cursor.ch).trim() === '') {
					return true;
				}
			} catch (e) {
				return true; // Err on the side of caution
			}
		}

		return false;
	}

	function scrollToSelected() {
		if (!popupEl) return;

		const selectedEl = popupEl.querySelector(
			".item.selected",
		) as HTMLElement;
		if (selectedEl) {
			selectedEl.scrollIntoView({ block: "nearest" });
		}
	}

	function handleMouseOver(index: number) {
		selected = index;
	}

	function handleClick(index: number) {
		selected = index;
		accept();
	}

	function getDisplayTitle(match: {
		title: string;
		file: any;
		isAlias: boolean;
	}): string {
		if (match.isAlias) {
			return `${match.title} → ${match.file.basename}`;
		}
		return match.title;
	}

	function highlightMatch(title: string): string {
		if (!typed) return title;

		const index = title.toLowerCase().indexOf(typed.toLowerCase());
		if (index === -1) return title;

		const before = title.slice(0, index);
		const match = title.slice(index, index + typed.length);
		const after = title.slice(index + typed.length);

		return `${before}<mark>${match}</mark>${after}`;
	}

	function positionPopup() {
		if (!popupEl || !position) return;

		const rect = popupEl.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;

		let left = position.left;
		// Position popup so its TOP starts BELOW the current line
		let top = position.bottom + 5; // 5px below the bottom of current line

		// Adjust if popup would go off screen horizontally
		if (left + rect.width > viewportWidth) {
			left = Math.max(10, viewportWidth - rect.width - 10);
		}
		
		// Ensure popup doesn't go off the left edge
		left = Math.max(10, left);

		// Adjust if popup would go off screen vertically
		if (top + rect.height > viewportHeight) {
			// Only place above if there's not enough space below
			const spaceBelow = viewportHeight - position.bottom;
			const spaceAbove = position.top;
			
			// If there's more space above, or if it doesn't fit below at all
			if (spaceAbove > spaceBelow || spaceBelow < rect.height) {
				top = Math.max(10, position.top - rect.height - 5); // Above cursor
			} else {
				// Try to fit below but adjust if needed
				top = Math.min(top, viewportHeight - rect.height - 10);
			}
		}

		// Ensure popup doesn't go off the top edge
		top = Math.max(10, top);

		popupEl.style.left = `${left}px`;
		popupEl.style.top = `${top}px`;
		popupEl.style.position = 'fixed';
		popupEl.style.zIndex = '10000';
	}

	// Close popup if clicked outside
	function handleOutsideClick(event: MouseEvent) {
		if (popupEl && !popupEl.contains(event.target as Node)) {
			onClose();
		}
	}

	// Prevent popup from interfering with editor focus
	function handlePopupFocus(event: FocusEvent) {
		// Don't prevent the editor from maintaining focus
		event.preventDefault();
	}

	onMount(() => {
		isActive = true;
		
		// Position popup near cursor
		positionPopup();

		// Use capture phase to ensure we get events before other handlers
		document.addEventListener("keydown", handleKeydown, { capture: true });
		document.addEventListener("click", handleOutsideClick);
		
		// Prevent popup from stealing focus from editor
		if (popupEl) {
			popupEl.addEventListener("focus", handlePopupFocus);
			popupEl.addEventListener("mousedown", (e) => {
				// Prevent mousedown from changing focus away from editor
				e.preventDefault();
			});
		}

		return () => {
			isActive = false;
			document.removeEventListener("keydown", handleKeydown, { capture: true });
			document.removeEventListener("click", handleOutsideClick);
			if (popupEl) {
				popupEl.removeEventListener("focus", handlePopupFocus);
			}
		};
	});

	onDestroy(() => {
		isActive = false;
		document.removeEventListener("keydown", handleKeydown, { capture: true });
		document.removeEventListener("click", handleOutsideClick);
	});
</script>

<div
	bind:this={popupEl}
	class="autolink-popup"
	role="listbox"
	aria-label="Note suggestions"
	tabindex="-1"
>
	<div class="popup-header">
		<span class="popup-title">Link to note</span>
		<span class="popup-hint">
			↑↓ navigate • 
			{#if allowEnterAccept}Enter/{/if}Tab/Ctrl+Space/1-9 select • Esc cancel
		</span>
	</div>

	<div class="suggestions-list" role="list">
		{#each matches as match, i}
			<div
				class="item"
				class:selected={i === selected}
				role="option"
				aria-selected={i === selected}
				tabindex="-1"
				on:mouseover={() => handleMouseOver(i)}
				on:click={() => handleClick(i)}
			>
				<div class="item-title">
					{@html highlightMatch(getDisplayTitle(match))}
				</div>
				{#if match.isAlias}
					<div class="item-type">alias</div>
				{:else}
					<div class="item-type">note</div>
				{/if}
				<div class="item-path">{match.file.path}</div>
			</div>
		{/each}
	</div>

	{#if matches.length === 0}
		<div class="no-matches">No matching notes found</div>
	{/if}
</div>

<style>
	.autolink-popup {
		position: fixed;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 0;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		font-family: var(--font-interface);
		font-size: var(--font-ui-small);
		z-index: 10000;
		min-width: 250px;
		max-width: 400px;
		max-height: 300px;
		overflow: hidden;
		backdrop-filter: blur(10px);
		/* Stick to a specific position rather than floating */
		transform: none;
		transition: none;
	}

	.popup-header {
		padding: 8px 12px;
		background: var(--background-secondary);
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-shrink: 0;
	}

	.popup-title {
		font-weight: 600;
		color: var(--text-normal);
	}

	.popup-hint {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}

	.suggestions-list {
		max-height: 240px;
		overflow-y: auto;
		/* Better positioning within popup */
		position: relative;
	}

	.item {
		padding: 8px 12px;
		cursor: pointer;
		border-bottom: 1px solid var(--background-modifier-border-hover);
		transition: background-color 0.1s ease;
		display: flex;
		flex-direction: column;
		gap: 2px;
		outline: none;
		/* Prevent text selection */
		user-select: none;
		-webkit-user-select: none;
	}

	.item:last-child {
		border-bottom: none;
	}

	.item:hover,
	.item.selected {
		background: var(--background-modifier-hover);
	}

	.item.selected {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.item-title {
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.item-type {
		font-size: var(--font-ui-smaller);
		opacity: 0.7;
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.5px;
	}

	.item-path {
		font-size: var(--font-ui-smaller);
		opacity: 0.6;
		font-family: var(--font-monospace);
	}

	.no-matches {
		padding: 20px;
		text-align: center;
		color: var(--text-muted);
		font-style: italic;
	}

	/* Highlight matched text */
	:global(.autolink-popup mark) {
		background: var(--text-selection);
		color: inherit;
		padding: 1px 2px;
		border-radius: 2px;
	}

	.item.selected :global(mark) {
		background: rgba(255, 255, 255, 0.3);
	}

	/* Scrollbar styling */
	.suggestions-list::-webkit-scrollbar {
		width: 6px;
	}

	.suggestions-list::-webkit-scrollbar-track {
		background: var(--background-secondary);
	}

	.suggestions-list::-webkit-scrollbar-thumb {
		background: var(--background-modifier-border);
		border-radius: 3px;
	}

	.suggestions-list::-webkit-scrollbar-thumb:hover {
		background: var(--background-modifier-border-hover);
	}

	/* Dark theme adjustments */
	.theme-dark .autolink-popup {
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}

	/* Animation */
	.autolink-popup {
		animation: popupFadeIn 0.15s ease-out;
	}

	@keyframes popupFadeIn {
		from {
			opacity: 0;
			transform: translateY(-5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Ensure popup stays positioned correctly */
	.autolink-popup {
		pointer-events: auto;
		will-change: auto;
	}
</style>