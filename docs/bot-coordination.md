# Bot coordination

TDM, Kill Confirmed and CTF bots stage and flank together, fall back toward allies when wounded, and have support/marksmen cover retreating teammates. Existing line-of-sight, reaction, firing, collision and routing rules still apply. Flag duties take priority.

Z issues Attack, C Defend, and V Regroup. Touch controls offer the same labelled buttons. Orders last fifteen seconds, replace the previous team order and have a two-second cooldown. The server independently calculates the destination from accepted position and aim, validates the issuer and sends the order only to teammates. Attack selects a nearby navigable approach; Defend and Regroup use the issuer's location. The HUD confirms the active order. Dead/absent issuers stop influencing allies.

Survival, FFA and Gun Game retain independent AI. Browser review remains needed for movement feel and touch placement.
