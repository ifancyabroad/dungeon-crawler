import tilesetUrl from "../assets/tileset/The Roguelike Remastered 1-6-10 Alpha.png";
import { TILE_WIDTH, TILE_HEIGHT, TILESET_COLUMNS } from "../game/tiles/tilesetRegistry";

type TileSpriteProps = {
	tileIndex: number;
	/** Display size in CSS pixels. The 32×32 tile is scaled to this. */
	size?: number;
	className?: string;
};

export function TileSprite({ tileIndex, size = 64, className }: TileSpriteProps) {
	const col = tileIndex % TILESET_COLUMNS;
	const row = Math.floor(tileIndex / TILESET_COLUMNS);

	const scale = size / TILE_WIDTH;
	const sheetWidth = TILESET_COLUMNS * TILE_WIDTH;

	return (
		<div
			className={className}
			style={{
				width: size,
				height: size,
				backgroundImage: `url(${tilesetUrl})`,
				backgroundPosition: `-${col * TILE_WIDTH * scale}px -${row * TILE_HEIGHT * scale}px`,
				backgroundSize: `${sheetWidth * scale}px auto`,
				backgroundRepeat: "no-repeat",
				imageRendering: "pixelated",
			}}
		/>
	);
}
