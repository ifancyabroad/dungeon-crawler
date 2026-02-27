/**
 * Minimal dungeon HUD overlay. Renders on top of the Phaser canvas.
 * Uses design tokens (bg-bg-surface, text-text) for future health, inventory, etc.
 */
export default function GameOverlay() {
	return (
		<div className="pointer-events-none absolute inset-0 flex flex-col items-stretch p-4">
			{/* Top bar: placeholder for future HUD (health, minimap, etc.) */}
			<div className="flex justify-between items-center">
				<div className="rounded bg-bg-surface/90 border border-border px-3 py-1.5 text-sm text-text">
					WASD to move
				</div>
			</div>
		</div>
	);
}
