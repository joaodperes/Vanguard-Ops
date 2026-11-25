Search & Destroy is enabled on Dustwater, Verdant Ruins (`compound`) and
Ridgefall (`skybridge`). Each arena has two map-specific bomb sites. Dustwater
uses dedicated red/blue S&D spawn pools: site A is at the north-west edge ([-36, 0, -40]) and site B is at the
north-east edge ([36, 0, -40]), clear of the dynamite props.
Verdant Ruins uses [-30, 0, -5] and [30, 0, 5]; Ridgefall uses
[-30, 0, 50] and [30, 0, 50]. Verdant Ruins and Ridgefall reuse their balanced
team spawn pools. S&D room sizes are capped at 3v3, 4v4 and 5v5 to match the
five unique spawn points per side.

Hardpoint currently remains Dustwater-only and uses five authored hill
positions. Before enabling it on another arena, add map-specific hill positions
and validate their clearance and bot routes.

Frontier has no fixed objective locations. It is limited to Dustwater,
Whiteout Depot (`whiteout_depot`) and Emberhold Castle (`emberhold`), using
the authored Frontier spawn pools on Dustwater and the tested team spawn pools
on the other two maps. Do not enable another map by changing only its
`modes` array: add mode-appropriate spawn pools and objective locations, then
validate objective clearance and bot routes.
