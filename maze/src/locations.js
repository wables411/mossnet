// Every maze is modelled on a real place. The level picks one in order and the
// difficulty curve runs on top. No two places share a wall surface or a layout.
//
// layout:  how the room maze becomes tiles (maze.js): `room` tiles per room side,
//          `gap` tiles of passage through a wall, `tile` width in metres (shrinking
//          with the level down to `tileMin`), `straight` bias of the carver,
//          `braid` share of dead ends opened into loops, wall `height`.
// wall:    kind 'carved' (a rock or earth bank, carved by the field in geometry.js
//          with this place's `carve` profile), 'logs' (stacked fallen trunks),
//          'trunks' (a palisade of standing trees on a low bank).
// zones:   the carved wall's material per zone (MATERIAL_SPECS in world.js);
//          floor: the ground material; kit: materials the props borrow.
// ceiling: 'canopy' (trees; `canopy` is how much of the sky they cover),
//          'tunnel' (brick vaults), 'bridges' (rock spans over some corridors and
//          over every dead end), 'sky' (open above, a few trees)
// relief:  the floor: hollows [amplitude, scale], a slope [per metre x, z],
//          channels [depth, scale] (flooded where the ground dips)
// water:   a still water level over the whole maze, where the ground is below it
// ground:  'wet' | 'dry' | 'rock' | 'mud'  -> footstep sound
// sky:     zenith colour and how much canopy blotching closes it
// mosses:  native species (names checked against the Moss Quest MossDex, built
//          from GBIF), each with a growth form the shader and the props use:
//          form: 'cushion' (full, dense, short)   'carpet' (flat glossy mats)
//                'feather' (fern-like, loose)      'haircap' (tall stiff shoots)
//                'stringy' (lanky, open, trailing) 'hanging' (pendant, from branches and ledges)
//          color: the live colour; scale: how fine its texture reads (1 = default)
//          notMoss: captioned with the mosses but not one (Spanish moss is a bromeliad)
// cover:   how much of the difficulty's moss coverage this place's walls and floor take (1 = all of it)
// weather: chances rolled when the maze is built (rain, snow, fog, and dusk / night for the time of
//          day the visit lands in); wind: [low, high] strength 0..1
// sound:   animals by day, and the `night` list after dark (dusk draws on both); fireflies: how many, near water

export const LOCATIONS = [
  {
    id: 'yakushima', name: 'Yakushima', place: 'Shiratani Unsuikyō, Yakushima, Japan',
    blurb: 'granite boulders under cedar roots, hollows joined by narrow gaps, a stream',
    layout: { room: 3, gap: 1, tile: 1.45, tileMin: 1.2, straight: 0.3, braid: 0.3, height: 2.4, heightMax: 3.0 },
    wall: { kind: 'carved', round: 0.5, carve: { amp: 0.6, lump: 0.26, lumpScale: 1.3, heave: 1.3 } },
    zones: ['granite', 'granite', 'dirt', 'granite', 'granite'], moss: ['moss1', 'moss3'], floor: 'dirt', floorMoss: ['moss1', 'moss3'],
    kit: { bark: 'wood', rock: 'granite' },
    ceiling: 'canopy', canopy: 0.7, canopyHeight: 10, trees: 0.5, hanging: 0.5,
    relief: { hollows: [0.14, 0.35] }, stream: true, water: null, fireflies: 0.7,
    cover: { wall: 0.5, floor: 0.9 },
    sky: { zenith: 0x2a352a, canopy: 1 },
    mosses: [
      { name: 'Hypnum plumaeforme', common: 'Cypress-leaved plaitmoss', form: 'carpet', color: 0x9fb33a, scale: 1.1 },
      { name: 'Leucobryum juniperoideum', common: 'Smaller White-moss', form: 'cushion', color: 0xb9c99a, scale: 0.9 },
      { name: 'Thuidium kanedae', common: 'Kaneda’s tamarisk-moss', form: 'feather', color: 0x6f9a3c, scale: 1.3 },
      { name: 'Pyrrhobryum dozyanum', common: 'Dozy’s feather-tuft moss', form: 'haircap', color: 0x4f7d3a, scale: 1.0 },
      { name: 'Homaliodendron flabellatum', common: 'fan moss', form: 'stringy', color: 0x5f8a48, scale: 1.2 },
      { name: 'Barbella flagellifera', common: 'hanging thread-moss', form: 'hanging', color: 0x8fa86a, scale: 1.0 },
    ],
    fog: { color: 0x8b9a86, mul: 1.0 }, light: { sun: 0xfff0d2, sunI: 3.0, sky: 0x9aa39a, ground: 0x332a1c, hemiI: 1.05 },
    weather: { rain: 0.5, snow: 0, fog: 0.3, dusk: 0.18, night: 0.14 }, wind: [0.1, 0.4],
    mud: 0.5, ground: 'wet',
    props: { logs: 0.4, boulders: 1.2, mushrooms: 0.5, ferns: 0.8, grass: 0.3, plants: 0.4, roots: 1.0 },
    sound: { wind: 0.4, drips: 1.0, stream: 1.0, reverb: 0.3, animals: ['warbler', 'deer', 'crow', 'frog'], night: ['owl', 'frog', 'frog', 'deer', 'cricket'] },
    models: ['pine_tree_01', 'pine_roots', 'root_cluster_01', 'boulder_01', 'rock_moss_set_01', 'stone_01', 'fern_02', 'moss_01'],
  },
  {
    id: 'aokigahara', name: 'Aokigahara', place: 'Aokigahara, Mount Fuji, Japan',
    blurb: 'the sea of trees: long lava corridors, low broken walls, roots over black rock, no undergrowth',
    layout: { room: 1, gap: 1, tile: 1.9, tileMin: 1.4, straight: 0.85, braid: 0.1, height: 2.0, heightMax: 2.6 },
    wall: { kind: 'carved', round: 0.22, carve: { amp: 1.0, lump: 0.1, lumpScale: 2.0, heave: 1.9 } },
    zones: ['lava', 'lava', 'lavafloor', 'lava', 'lava'], moss: ['moss1', 'moss3'], floor: 'lavafloor', floorMoss: ['moss1', 'moss3'],
    kit: { bark: 'wood', rock: 'lava' },
    ceiling: 'canopy', canopy: 0.95, canopyHeight: 8, trees: 0.9, hanging: 0.15,
    relief: { hollows: [0.06, 0.5] }, stream: false, water: null,
    cover: { wall: 0.6, floor: 1.0 },
    sky: { zenith: 0x1b241a, canopy: 1 },
    mosses: [
      { name: 'Hypnum plumaeforme', common: 'Cypress-leaved plaitmoss', form: 'carpet', color: 0x8fa838, scale: 1.1 },
      { name: 'Dicranum scoparium', common: 'Broom Fork-moss', form: 'cushion', color: 0x3f6b30, scale: 1.0 },
      { name: 'Leucobryum glaucum', common: 'Large White Moss', form: 'cushion', color: 0xc2d2a8, scale: 0.9 },
      { name: 'Polytrichum commune', common: 'Common Hair-cap Moss', form: 'haircap', color: 0x2f5a35, scale: 1.0 },
      { name: 'Racomitrium lanuginosum', common: 'Woolly Fringe-moss', form: 'cushion', color: 0x9aa48e, scale: 1.2 },
      { name: 'Hylocomium splendens', common: 'Glittering Wood-moss', form: 'feather', color: 0x7f9a3c, scale: 1.3 },
    ],
    fog: { color: 0x5e6858, mul: 1.15 }, light: { sun: 0xf6ecd4, sunI: 1.8, sky: 0x76836f, ground: 0x1e1a12, hemiI: 0.8 },
    weather: { rain: 0.15, snow: 0.2, fog: 0.5, dusk: 0.35, night: 0.2 }, wind: [0.0, 0.12],
    mud: 0.15, ground: 'rock',
    props: { logs: 0.7, boulders: 0.8, mushrooms: 0.5, ferns: 0, grass: 0, plants: 0, roots: 0.6 },
    sound: { wind: 0.12, drips: 0.3, stream: 0, reverb: 0.2, animals: ['warbler', 'crow', 'owl'], night: ['owl', 'owl', 'deer', 'cricket'] },
    models: ['fir_tree_01', 'tree_small_02', 'dead_tree_trunk_02', 'root_cluster_01', 'rock_moss_set_02', 'rock_07', 'moss_01'],
  },
  {
    id: 'hoh', name: 'Hoh Rainforest', place: 'Hoh Rain Forest, Olympic Peninsula, Washington',
    blurb: 'nurse logs stacked for walls, winding gaps between the trunks, ferns, rain that never quite stops',
    layout: { room: 1, gap: 1, tile: 1.9, tileMin: 1.45, straight: 0.1, braid: 0.3, height: 2.3, heightMax: 2.8 },
    wall: { kind: 'logs', logs: { material: 'barkmoss' } },
    zones: ['barkmoss'], moss: ['moss1', 'moss3'], floor: 'forestfloor', floorMoss: ['moss1', 'moss3'],
    kit: { bark: 'barkmoss', rock: 'stone' },
    ceiling: 'canopy', canopy: 0.75, canopyHeight: 11, trees: 0.55, hanging: 1.0,
    relief: { hollows: [0.08, 0.4] }, stream: true, water: null,
    cover: { wall: 0.85, floor: 1.0 },
    sky: { zenith: 0x26321f, canopy: 1 },
    mosses: [
      { name: 'Isothecium stoloniferum', common: 'cat-tail moss', form: 'hanging', color: 0x8da85a, scale: 1.0 },
      { name: 'Antitrichia curtipendula', common: 'Antitrichia Moss', form: 'hanging', color: 0x6f8f3e, scale: 1.0 },
      { name: 'Kindbergia oregana', common: 'Oregon Beaked Moss', form: 'feather', color: 0x9db83c, scale: 1.3 },
      { name: 'Rhytidiadelphus loreus', common: 'Lanky Moss', form: 'stringy', color: 0x8fb050, scale: 1.2 },
      { name: 'Hylocomium splendens', common: 'Glittering Wood-moss', form: 'feather', color: 0x7f9a3c, scale: 1.3 },
      { name: 'Dicranum scoparium', common: 'Broom Fork-moss', form: 'cushion', color: 0x3f6b30, scale: 1.0 },
    ],
    fog: { color: 0x93a08f, mul: 0.9 }, light: { sun: 0xf2f0e6, sunI: 2.2, sky: 0xa3aba0, ground: 0x332a1c, hemiI: 1.15 },
    weather: { rain: 0.85, snow: 0, fog: 0.3, dusk: 0.15, night: 0.12 }, wind: [0.1, 0.35],
    mud: 0.9, ground: 'mud',
    props: { logs: 0.3, boulders: 0.1, mushrooms: 0.9, ferns: 1.0, grass: 0.3, plants: 0.6, roots: 0 },
    sound: { wind: 0.3, drips: 1.2, stream: 1.0, reverb: 0.35, animals: ['wren', 'raven', 'elk', 'frog'], night: ['frog', 'frog', 'owl', 'elk'] },
    models: ['fir_tree_01', 'island_tree_02', 'fern_02', 'shrub_02', 'moss_01', 'tree_stump_01', 'rock_09'],
    // the original set, grown from build/field/hoh.md by build/gen_hoh (?gen=1 while it is judged against the scans)
    genModels: ['hoh_sitka_spruce', 'hoh_western_hemlock', 'hoh_bigleaf_maple', 'hoh_sword_fern', 'hoh_oregon_oxalis', 'hoh_spruce_snag', 'hoh_river_cobbles'],
  },
  {
    id: 'williamson', name: 'Williamson Tunnels', place: 'Edge Hill, Liverpool, England',
    blurb: 'hand-made brick vaults over sandstone, long galleries with chambers off them, standing water',
    layout: { room: 1, gap: 1, tile: 2.2, tileMin: 1.5, straight: 0.85, braid: 0.0, height: 2.9, heightMax: 3.4 },
    wall: { kind: 'carved', round: 0.04, carve: { amp: 0.3, heave: 0.15 } },
    zones: ['brick', 'brick', 'stone', 'brick', 'brick'], moss: ['moss3', 'moss1'], floor: 'wetstone', floorMoss: ['moss1', 'moss3'],
    kit: { vault: 'brick', rock: 'stone', bark: 'wood' },
    ceiling: 'tunnel', canopy: 0, trees: 0, hanging: 0.2,
    relief: { hollows: [0.07, 0.6] }, stream: false, water: { level: -0.035, color: 0x0b0d0b },
    cover: { wall: 0.22, floor: 0.5 },
    sky: { zenith: 0x2a2f2a, canopy: 1 },
    mosses: [
      { name: 'Tortula muralis', common: 'Wall Screw-moss', form: 'cushion', color: 0x7f8f55, scale: 0.8 },
      { name: 'Grimmia pulvinata', common: 'Grey-cushioned Grimmia', form: 'cushion', color: 0x8c9480, scale: 0.8 },
      { name: 'Amblystegium serpens', common: 'Creeping Feather-moss', form: 'carpet', color: 0x6f8a3a, scale: 1.2 },
      { name: 'Rhynchostegium confertum', common: 'Clustered Feather-moss', form: 'carpet', color: 0x7f9a44, scale: 1.1 },
      { name: 'Brachythecium rutabulum', common: 'Rough-stalked Feather-moss', form: 'stringy', color: 0x9fb34a, scale: 1.1 },
      { name: 'Schistidium crassipilum', common: 'Thickpoint Bloom Moss', form: 'cushion', color: 0x5f6e4a, scale: 0.8 },
    ],
    fog: { color: 0x565c54, mul: 0.85 }, light: { sun: 0xd9e4ff, sunI: 1.4, sky: 0xb0b8ae, ground: 0x332c26, hemiI: 2.6 },
    weather: { rain: 0, snow: 0, fog: 0.2, dusk: 0, night: 0 }, wind: [0, 0.05],
    mud: 0.3, ground: 'rock',
    props: { logs: 0, boulders: 0.35, mushrooms: 0.6, ferns: 0.1, grass: 0, plants: 0.1, roots: 0 },
    sound: { wind: 0.05, drips: 1.6, stream: 0.25, reverb: 1.0, animals: ['pigeon', 'drip'], night: ['pigeon', 'drip'] },
    models: ['rock_07', 'stone_01', 'moss_01'],
  },
  {
    id: 'wistmans', name: "Wistman's Wood", place: 'Dartmoor, Devon, England',
    blurb: 'a granite clitter field: low lichened boulders you can see over, stunted oaks, grey sky, wind',
    layout: { room: 2, gap: 2, tile: 1.5, tileMin: 1.2, straight: 0.4, braid: 0.6, height: 1.25, heightMax: 1.6 },
    wall: { kind: 'carved', round: 0.45, carve: { amp: 0.7, lump: 0.25, lumpScale: 1.6, heave: 2.0 } },
    zones: ['clitter'], moss: ['moss1', 'moss3'], floor: 'moorgrass', floorMoss: ['moss1', 'moss3'],
    kit: { bark: 'wood', rock: 'clitter' },
    ceiling: 'sky', canopy: 0.06, canopyHeight: 7, trees: 0.5, hanging: 0.6,
    relief: { hollows: [0.1, 0.3], slope: [0.012, 0.004] }, stream: false, water: null,
    cover: { wall: 0.45, floor: 0.8 },
    sky: { zenith: 0x9aa3a6, canopy: 0.15 },
    mosses: [
      { name: 'Polytrichum formosum', common: 'Bank Haircap', form: 'haircap', color: 0x335f36, scale: 1.0 },
      { name: 'Dicranum majus', common: 'Greater Fork-moss', form: 'cushion', color: 0x4a7a38, scale: 1.0 },
      { name: 'Rhytidiadelphus loreus', common: 'Lanky Moss', form: 'stringy', color: 0x8fb050, scale: 1.2 },
      { name: 'Isothecium myosuroides', common: 'Slender Mouse-tail Moss', form: 'hanging', color: 0x7f9a4c, scale: 1.0 },
      { name: 'Hypnum cupressiforme', common: 'Cypress-leaved Plait-moss', form: 'carpet', color: 0x9aa83c, scale: 1.1 },
      { name: 'Thuidium tamariscinum', common: 'Common Tamarisk-moss', form: 'feather', color: 0x6f9a3c, scale: 1.3 },
    ],
    fog: { color: 0xa7aeab, mul: 0.9 }, light: { sun: 0xf4f2ea, sunI: 1.7, sky: 0xb8c0bd, ground: 0x3a3a2c, hemiI: 1.35 },
    weather: { rain: 0.4, snow: 0.12, fog: 0.35, dusk: 0.2, night: 0.12 }, wind: [0.4, 1.0],
    mud: 0.3, ground: 'wet',
    props: { logs: 0.2, boulders: 1.6, mushrooms: 0.3, ferns: 0.4, grass: 1.0, plants: 0.2, roots: 0 },
    sound: { wind: 0.95, drips: 0.3, stream: 0, reverb: 0.1, animals: ['raven', 'wren', 'sheep'], night: ['owl', 'sheep', 'cricket'] },
    models: ['boulder_01', 'rock_moss_set_01', 'rock_moss_set_02', 'tree_small_02', 'tree_stump_01', 'moss_01'],
  },
  {
    id: 'fanal', name: 'Fanal Forest', place: 'Fanal, Madeira, Portugal',
    blurb: 'no built walls: palisades of laurel trunks on a grass slope, red soil through the grass, fog does the hiding',
    layout: { room: 2, gap: 2, tile: 1.8, tileMin: 1.4, straight: 0.4, braid: 0.5, height: 0.3, heightMax: 0.3 },
    wall: { kind: 'trunks', bank: 0.3, trunk: { material: 'laurel', radius: [0.18, 0.34], flare: 0.22, lean: 0.07, per: 3, height: 11, tint: 0xb4b8ac } },
    zones: ['redsoil'], moss: ['moss3', 'moss1'], floor: 'redsoil', floorMoss: ['moss3', 'moss1'],
    kit: { bark: 'laurel', rock: 'stone' },
    ceiling: 'canopy', canopy: 0.55, canopyHeight: 9, trees: 0.25, hanging: 0.8,
    relief: { hollows: [0.06, 0.4], slope: [0.035, 0.012] }, stream: false, water: null,
    cover: { wall: 0.6, floor: 0.7 },
    sky: { zenith: 0xb5bab2, canopy: 0.4 },
    mosses: [
      { name: 'Neckera intermedia', common: 'Madeira neckera', form: 'hanging', color: 0x8aa050, scale: 1.0 },
      { name: 'Homalothecium sericeum', common: 'Silky Wall Feather-moss', form: 'carpet', color: 0xa8b24a, scale: 1.1 },
      { name: 'Hypnum cupressiforme', common: 'Cypress-leaved Plait-moss', form: 'carpet', color: 0x9aa83c, scale: 1.1 },
      { name: 'Leucodon sciuroides', common: 'Squirrel-tail Moss', form: 'stringy', color: 0x6f7f3c, scale: 1.0 },
      { name: 'Thuidium tamariscinum', common: 'Common Tamarisk-moss', form: 'feather', color: 0x6f9a3c, scale: 1.3 },
      { name: 'Isothecium alopecuroides', common: 'Larger Mouse-tail Moss', form: 'hanging', color: 0x7f9a4c, scale: 1.0 },
    ],
    fog: { color: 0x9ea69a, mul: 1.3 }, light: { sun: 0xffffff, sunI: 1.1, sky: 0xb0b8ac, ground: 0x3a3426, hemiI: 1.25 },
    weather: { rain: 0.25, snow: 0, fog: 0.9, dusk: 0.15, night: 0.1 }, wind: [0.3, 0.7],
    mud: 0.4, ground: 'wet',
    props: { logs: 0.3, boulders: 0.15, mushrooms: 0.3, ferns: 0.3, grass: 1.0, plants: 0.4, roots: 0 },
    sound: { wind: 0.6, drips: 0.3, stream: 0, reverb: 0.15, animals: ['chaffinch', 'cowbell', 'crow'], night: ['owl', 'cowbell', 'cricket'] },
    models: ['island_tree_02', 'shrub_02', 'moss_01', 'rock_09', 'dead_tree_trunk'],
  },
  {
    id: 'puzzlewood', name: 'Puzzlewood', place: 'Forest of Dean, Gloucestershire, England',
    blurb: 'limestone scowles: deep narrow cuts, rock bridges overhead, cave mouths, steps and hollows',
    layout: { room: 1, gap: 1, tile: 1.5, tileMin: 1.2, straight: 0.3, braid: 0.15, height: 3.6, heightMax: 4.2 },
    wall: { kind: 'carved', round: 0.14, carve: { amp: 0.8, lump: 0.12, lumpScale: 0.9, heave: 0.8 } },
    zones: ['limestone', 'limestone', 'scowle', 'limestone', 'limestone'], moss: ['moss1', 'moss3'], floor: 'scowle', floorMoss: ['moss1', 'moss3'],
    kit: { bark: 'wood', rock: 'limestone', ceiling: 'limestone' },
    ceiling: 'bridges', bridges: 0.16, canopy: 0.7, canopyHeight: 10, trees: 0.5, hanging: 0.5,
    relief: { hollows: [0.26, 0.25] }, stream: true, water: null,
    cover: { wall: 0.7, floor: 0.9 },
    sky: { zenith: 0x2a352a, canopy: 1 },
    mosses: [
      { name: 'Thamnobryum alopecurum', common: 'Fox-tail Feather-moss', form: 'stringy', color: 0x3f6a34, scale: 1.1 },
      { name: 'Eurhynchium striatum', common: 'Common Striated Feather-moss', form: 'feather', color: 0x7fa040, scale: 1.3 },
      { name: 'Plagiomnium undulatum', common: 'Hart’s-Tongue Thyme-moss', form: 'carpet', color: 0x6f9a48, scale: 1.0 },
      { name: 'Ctenidium molluscum', common: 'Chalk Comb-moss', form: 'carpet', color: 0xa8b848, scale: 1.1 },
      { name: 'Anomodon viticulosus', common: 'Rambling Tail-moss', form: 'hanging', color: 0x6f8a3c, scale: 1.0 },
      { name: 'Dicranum scoparium', common: 'Broom Fork-moss', form: 'cushion', color: 0x3f6b30, scale: 1.0 },
    ],
    fog: { color: 0x7f8c79, mul: 1.0 }, light: { sun: 0xfff0d2, sunI: 2.6, sky: 0x9aa39a, ground: 0x2a2416, hemiI: 1.0 },
    weather: { rain: 0.35, snow: 0.05, fog: 0.25, dusk: 0.15, night: 0.14 }, wind: [0.05, 0.3],
    mud: 0.4, ground: 'rock',
    props: { logs: 0.5, boulders: 1.0, mushrooms: 0.6, ferns: 0.9, grass: 0.3, plants: 0.4, roots: 0.5 },
    sound: { wind: 0.3, drips: 1.0, stream: 0.8, reverb: 0.5, animals: ['wren', 'pigeon', 'owl'], night: ['owl', 'owl', 'drip'] },
    models: ['boulder_01', 'rock_moss_set_02', 'root_cluster_01', 'fern_02', 'moss_01', 'island_tree_02', 'tree_stump_02', 'dead_tree_trunk'],
  },
  {
    id: 'congaree', name: 'Congaree', place: 'Congaree National Park, South Carolina',
    blurb: 'a blackwater swamp: bald cypress and tupelo, knees in clusters, Spanish moss on everything, channels waded ankle-deep',
    layout: { room: 2, gap: 1, tile: 1.7, tileMin: 1.35, straight: 0.5, braid: 0.45, height: 0.25, heightMax: 0.25 },
    wall: { kind: 'trunks', bank: 0.25, trunk: { material: 'cypress', radius: [0.2, 0.38], flare: 0.9, lean: 0.02, per: 2, height: 16, tint: 0xbcae9a, knees: 1.0, spanish: 1.0 } },
    zones: ['mud'], moss: ['moss1', 'moss3'], floor: 'mud', floorMoss: ['moss1', 'moss3'],
    kit: { bark: 'cypress', rock: 'stone' },
    ceiling: 'canopy', canopy: 0.8, canopyHeight: 15, trees: 0, hanging: 1.0,
    relief: { channels: [0.22, 0.42] }, stream: false, water: { level: -0.07, color: 0x17110a }, fireflies: 1.0,
    cover: { wall: 0.6, floor: 0.8 },
    sky: { zenith: 0x2f3a2a, canopy: 0.8 },
    mosses: [
      { name: 'Sphagnum palustre', common: 'Blunt-leaved Bog Moss', form: 'cushion', color: 0xa8c27a, scale: 0.9 },
      { name: 'Thuidium delicatulum', common: 'Delicate Tamarisk-moss', form: 'feather', color: 0x6f9a3c, scale: 1.3 },
      { name: 'Climacium americanum', common: 'American Tree Moss', form: 'haircap', color: 0x4f7d3a, scale: 1.0 },
      { name: 'Leucobryum albidum', common: 'pincushion moss', form: 'cushion', color: 0xbccfa4, scale: 0.9 },
      { name: 'Anomodon attenuatus', common: 'Tapered Tail-moss', form: 'stringy', color: 0x6f8a3c, scale: 1.1 },
      { name: 'Entodon seductrix', common: 'Seductive Entodon Moss', form: 'carpet', color: 0x9fb34a, scale: 1.1 },
      { name: 'Tillandsia usneoides', common: 'Spanish moss: a bromeliad, not a moss', form: 'hanging', color: 0xb9c4b0, scale: 1.0, notMoss: true },
    ],
    fog: { color: 0x859176, mul: 0.95 }, light: { sun: 0xffe9c4, sunI: 2.6, sky: 0xa3b094, ground: 0x2a2114, hemiI: 1.05 },
    weather: { rain: 0.3, snow: 0, fog: 0.4, dusk: 0.35, night: 0.25 }, wind: [0.05, 0.3],
    mud: 1.0, ground: 'mud',
    props: { logs: 0.5, boulders: 0, mushrooms: 0.3, ferns: 0.3, grass: 0.2, plants: 0.5, roots: 0 },
    sound: { wind: 0.15, drips: 0.4, stream: 0.5, reverb: 0.3, animals: ['frog', 'frog', 'barredowl', 'cicada', 'woodpecker'], night: ['frog', 'frog', 'frog', 'barredowl', 'cricket', 'cricket'] },
    models: ['dead_tree_trunk', 'root_cluster_02', 'shrub_02', 'moss_01', 'fern_02'],
  },
];

export function locationFor(level) { return LOCATIONS[(level - 1) % LOCATIONS.length]; }

// every photo set a place draws on: its walls, floor, mosses and whatever its props borrow
export function neededTextures(loc) {
  const out = new Set([...loc.zones, loc.floor, ...loc.moss, ...loc.floorMoss, ...Object.values(loc.kit || {})]);
  if (loc.wall && loc.wall.logs) out.add(loc.wall.logs.material);
  if (loc.wall && loc.wall.trunk) out.add(loc.wall.trunk.material);
  return [...out];
}

// Roll the weather for one visit. Returns { rain, snow, fog, wind } with
// rain/snow/fog 0..1 amounts and wind 0..1 strength.
export function rollWeather(loc, rng) {
  const w = loc.weather;
  const r = rng();
  let rain = 0, snow = 0;
  if (r < w.snow) snow = 0.4 + rng() * 0.6;
  else if (r < w.snow + w.rain) rain = 0.3 + rng() * 0.7;
  const fog = rng() < w.fog ? 0.4 + rng() * 0.6 : 0;
  const wind = loc.wind[0] + rng() * (loc.wind[1] - loc.wind[0]);
  // the time of day: most visits are by day; some are at dusk, a few at night (the tunnels know no difference)
  const t = rng();
  const time = t < (w.night || 0) ? 'night' : t < (w.night || 0) + (w.dusk || 0) ? 'dusk' : 'day';
  const night = time === 'night' ? 1 : time === 'dusk' ? 0.55 : 0;
  // the sky: clear or broken cloud lets the sun through in hard flecks and long shadows; rain, snow and fog keep it behind cloud
  const sun = rain || snow ? 0.15 : fog ? 0.4 : rng() < 0.8 ? 1 : 0.5;
  return { rain, snow, fog, wind, time, night, dusk: time === 'dusk' ? 1 : 0, sun };
}

// shader parameters per growth form: [textureScale, fuzzHeight, fuzzDensity, gloss]
export const FORM_PARAMS = {
  cushion: [0.9, 0.8, 1.3, 0.9],
  carpet: [1.1, 0.35, 1.0, 0.7],
  feather: [1.3, 0.6, 0.8, 0.95],
  haircap: [1.0, 1.6, 0.6, 1.0],
  stringy: [1.2, 1.3, 0.45, 0.95],
  hanging: [1.0, 1.2, 0.5, 0.9],
};

// the true mosses of a place (the captions also carry what is not one)
export function trueMosses(loc) { return loc.mosses.filter(m => !m.notMoss); }

// the shader's type list for a location: tint + params per native species (max 6)
export function mossTypes(loc) {
  return trueMosses(loc).slice(0, 6).map(m => ({ color: m.color, params: [...FORM_PARAMS[m.form]].map((v, i) => i === 0 ? v * (m.scale || 1) : v) }));
}
