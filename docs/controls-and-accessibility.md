# Controls and accessibility

Settings includes keyboard rebinding with automatic conflict swapping; Escape is
reserved for cancelling capture and opening the menu. All gameplay keys including
squad orders and scoreboard can be rebound. Fire and ADS retain mouse buttons.
Settings persist locally and apply live. Older saves receive safe defaults.

ADS sensitivity multiplies mouse/touch/controller aiming independently from base
sensitivity and optic zoom scaling. Standard browser-mapped gamepads support
analog movement, time-scaled look, radial deadzones and configurable sensitivity.
Press Start/Menu to enter controller play or toggle the ordinary match menu.
RT/LT fire/aim, or independently operate Akimbo and Juggernaut guns. A jumps,
X reloads, Y swaps, B interacts, R3 melees, L3 holds sprint, RB uses tactical,
LB equips Wonder, D-pad up/down/left selects primary/secondary/melee, View holds
the scoreboard. Menu screens and practice editors use mouse, keyboard or touch.
Separate Joy-Cons may require OS-level combination into a standard controller.

After focus loss, disconnect or menus, controller inputs must return to neutral.
Input listeners are removed when the engine is disposed. Touch layouts support
left-handed mirroring, scaling, opacity and edge spacing. Large layouts shrink
to fit smaller screens; held touch buttons release on cancellation or unmount.

Reduced motion removes weapon walking bob, sprint sway and HUD animation;
weapon recoil, zoom, gameplay effects and combat timing remain consistent.
Radar differentiates ally circles, enemy diamonds and the player's arrow.

Validation: run `bun test tests/control-settings.test.ts`, the full smoke suite,
typecheck and build. Physical controller, mobile multi-touch and browser visual
playtests remain required; automated logic tests do not establish device support.
