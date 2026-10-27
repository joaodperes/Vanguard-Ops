"use client";
import { DIFFICULTY_REWARDS } from "@/lib/match-rewards";
import { REWARDS, MAX_PLAYER_LEVEL } from "@/lib/game-data";
import { useGame } from "@/lib/game-store";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Crosshair, Swords, Shield, Skull, Zap, Coins, Target, Bot,
  Users, Lock, Map as MapIcon, Wrench, Palette, TrendingUp, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

export function FAQ() {
  const { setScreen } = useGame();

  return (
    <div className="min-h-screen flex flex-col">
      {/* header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setScreen("menu")} className="text-white/70 hover:text-white hover:bg-white/5">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-900/40">
              <Crosshair className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-black tracking-[0.18em] text-white text-sm leading-none">FIELD MANUAL</div>
              <div className="text-[10px] tracking-[0.25em] text-amber-400/80 leading-none mt-0.5">HOW TO PLAY</div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Getting Started */}
        <FaqSection icon={<Swords className="w-5 h-5 text-amber-400" />} title="Getting Started">
          <Accordion type="single" collapsible className="space-y-2">
            <FaqItem q="How do I play?">
              <p>Click <strong>Play</strong> in the top navigation to open the Room Lobby. From there you can <strong>Create a Room</strong> (configure the mode, map, team size, bot fill, and difficulty) or <strong>browse active rooms</strong> in the Room Browser and join one. When creating a room, you enter a lobby state — click <strong>Start Match</strong> when your friends have joined (or immediately if you want bots to fill empty slots).</p>
              <p className="mt-2">On desktop: click the screen to lock your mouse, then use <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">WASD</kbd> to move, mouse to aim, <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">Left-Click</kbd> to fire, <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">Right-Click</kbd> to ADS, <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">R</kbd> to reload, <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">Shift</kbd> to sprint, and <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">Space</kbd> to jump, and <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">F</kbd> for quick melee. Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">ESC</kbd> to release the cursor.</p>
              <p className="mt-2">On mobile: tap <strong>TAP TO PLAY</strong>, then use the left virtual stick to move, drag the right side to look, and tap the Fire/ADS/Reload/Jump/Quick Melee buttons.</p>
            </FaqItem>
            <FaqItem q="What are the game modes?">
              <ul className="space-y-1.5">
                <li><strong className="text-amber-300">Free-For-All (FFA):</strong> Everyone vs everyone. No teams. First to the kill limit (or highest kills when time runs out) wins.</li>
                <li><strong className="text-emerald-300">Capture the Flag (CTF):</strong> Red vs Blue (currently on Forest Warfare). Steal the enemy flag from its home and carry it to your marked delivery circle behind your base to score. Your own flag must be at home. A carrier moves 10% faster but glows to everyone with line of sight. A dropped flag can be reclaimed by an enemy, returned immediately by its team, or automatically reset at the configurable interval (instant, 10 seconds, 30 seconds, 1 minute, 2 minutes, or never). The default is first to three captures with a 10-minute limit; the host can disable either limit, but not both. A tie at the time limit starts sudden-death overtime: the next capture wins.</li>
                <li><strong className="text-rose-300">Team Deathmatch (TDM):</strong> Red vs Blue. Kills count toward your team&rsquo;s score. First team to the kill limit wins.</li>
                <li><strong className="text-cyan-300">Kill Confirmed:</strong> Red vs Blue. Defeated players drop a dogtag. Recover an enemy tag to score for your team; pick up friendly tags to deny enemy points. Tags expire after the room-selected tag lifetime (default 25 seconds). By default, friendly recoveries only deny an enemy point; hosts can enable +1 Denial Scoring so each recovered friendly tag also gives their team a point. The first team to the room score target (or the highest score at the time limit) wins.</li>
                <li><strong className="text-emerald-300">Survival (PvE):</strong> Solo or duo with limited reinforcements. Clear 30 waves on Standard for a large XP/credits reward and unlock Hard (endless, mutators change every 5 waves). Clear Hard wave 20 for Elite (mutators every wave and a boss every 10 waves), then Elite wave 20 for Nightmare (mutators stack instead of rotate).</li>
                <li><strong className="text-purple-300">Gun Game:</strong> Advance through a rotating 30-weapon list, finishing with Rocket Launcher and Melee. Weapons use base stats without Armory attachments; your chosen passive perk remains active. Free-for-all format — no teams.</li>
              </ul>
            </FaqItem>
            <FaqItem q="How do accounts and progression work?">
              <p>You can <strong>Register</strong> for an account (email + password) to persist your level, unlocks, and loadouts across devices. Or <strong>Continue as Guest</strong> — your progress stays in this browser only. Your player level increases as you earn XP from matches. Higher levels unlock new weapons, attachments, and ranks (visible in your profile card).</p>
            </FaqItem>
          </Accordion>
        </FaqSection>

        {/* Credits & Rewards */}
        <FaqSection icon={<Coins className="w-5 h-5 text-amber-400" />} title="Credits & Rewards">
          <Accordion type="single" collapsible className="space-y-2">
            <FaqItem q="What are credits?">
              <p>Credits are the in-game currency earned by playing matches. You spend them in the <strong>Armory</strong> to unlock new weapons, attachments, and player skins. Credits are earned from kills, match completion bonuses, daily challenges, and achievements. <strong>You cannot buy credits with real money</strong> — there are no microtransactions.</p>
            </FaqItem>
            <FaqItem q="How much XP/credits do I earn per kill?">
              <p>Rewards scale with the difficulty of the enemy you killed:</p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <RewardRow label="Easy Bot" xp={`${DIFFICULTY_REWARDS.easy.xp} XP`} cr={`${DIFFICULTY_REWARDS.easy.credits} CR`} color="#22c55e" />
                <RewardRow label="Normal Bot" xp={`${DIFFICULTY_REWARDS.normal.xp} XP`} cr={`${DIFFICULTY_REWARDS.normal.credits} CR`} color="#facc15" />
                <RewardRow label="Hard Bot" xp={`${DIFFICULTY_REWARDS.hard.xp} XP`} cr={`${DIFFICULTY_REWARDS.hard.credits} CR`} color="#f97316" />
                <RewardRow label="Veteran Bot" xp={`${DIFFICULTY_REWARDS.veteran.xp} XP`} cr={`${DIFFICULTY_REWARDS.veteran.credits} CR`} color="#ef4444" />
                <RewardRow label="Enemy Player" xp={`${DIFFICULTY_REWARDS.enemy_player.xp} XP`} cr={`${DIFFICULTY_REWARDS.enemy_player.credits} CR`} color="#ec4899" />
                <RewardRow label="Survival Kill" xp={`×${REWARDS.survivalKillMultiplier}`} cr={`×${REWARDS.survivalKillMultiplier}`} color="#06b6d4" />
              </div>
              <p className="mt-2">Survival kills award reduced rewards (×0.4) because players rack up very large kill counts. Enemy human players always count as &ldquo;veteran&rdquo; difficulty for rewards.</p>
            </FaqItem>
            <FaqItem q="What happens after the level cap?">
              <p>Equipment levels end at level {MAX_PLAYER_LEVEL}. In Profile, Career ranks use fresh post-cap XP and credits. Rank 1 needs 20,000 fresh XP and 5,000 CR; each following rank adds 5,000 XP and 2,500 CR to its cost. Promotions preserve equipment, level and mastery and award nameplate titles at Career ranks 1, 5 and 10.</p>
              <p className="mt-2">Each promotion starts a fresh XP goal. Historic XP and overflow from a full Career meter cannot fill later goals. Lifetime XP remains visible. Existing credits and purchases are preserved.</p>
            </FaqItem>
            <FaqItem q="What are daily challenges?">
              <p>Three rotating objectives refresh every 24 hours (at midnight). They include things like &ldquo;Get 25 kills&rdquo;, &ldquo;Land 10 headshots&rdquo;, or &ldquo;Win 3 matches&rdquo;. Completing a challenge awards bonus XP and credits. You can see today&rsquo;s challenges on the home screen.</p>
            </FaqItem>
          </Accordion>
        </FaqSection>

        {/* Weapons & Customization */}
        <FaqSection icon={<Wrench className="w-5 h-5 text-amber-400" />} title="Weapons & Customization">
          <Accordion type="single" collapsible className="space-y-2">
            <FaqItem q="How are weapons organized?">
              <p>Weapons are split into three loadout slots:</p>
              <ul className="space-y-1 mt-1.5">
                <li><strong className="text-amber-300">Primary:</strong> Assault rifles, SMGs, shotguns, DMRs, snipers, LMGs — your main weapon.</li>
                <li><strong className="text-rose-300">Secondary:</strong> Sidearms (pistols) — your backup when your primary runs dry.</li>
                <li><strong className="text-emerald-300">Melee:</strong> Knives — silent and lethal at touching distance.</li>
              </ul>
              <p className="mt-1.5">Visit the <strong>Armory</strong> to unlock new weapons and equip your primary, secondary, melee, and passive perk.</p>
            </FaqItem>
            <FaqItem q="How do attachments work?">
              <p>Each weapon supports a specific set of attachment slots (sight, barrel, grip, magazine) — not all weapons support all slots. For example, snipers don&rsquo;t have a grip slot, and the knife has no attachments at all.</p>
              <p className="mt-2">Attachments are <strong>unlocked per-weapon</strong> — buying a suppressor for your assault rifle doesn&rsquo;t give you one for your SMG. Visit a weapon in the Armory to see its compatible attachments and unlock them with credits. Attachments modify weapon stats: suppressors reduce damage but tighten spread, compensators cut recoil, extended mags add capacity, etc.</p>
            </FaqItem>
            <FaqItem q="How do weapon skins work?">
              <p>Skins are <strong>unlocked per-weapon via weapon challenges</strong>, not by player level or credits. Each weapon has specific challenges — for example, &ldquo;Get 50 kills with the VK-12 Assault&rdquo; to unlock the Crimson skin, or &ldquo;Land 100 headshots&rdquo; for the Neon skin. Visit a weapon in the Armory to see its challenges and your progress.</p>
              <p className="mt-2">Player skins (your operative&rsquo;s appearance) are still unlocked with credits in the Armory.</p>
            </FaqItem>
            <FaqItem q="How do shotguns and bolt-action snipers reload?">
              <p>Pump, automatic and combat shotguns, as well as the bolt-action sniper rifles, reload <strong>one shell or round at a time</strong>. You can interrupt a partial reload by firing once a round has been inserted. Rounds already loaded remain in the weapon if you sprint or swap away. Other weapons still reload their full magazines.</p>
            </FaqItem>
            <FaqItem q="How does Bullet Spitter work?">
              <p>The Bullet Spitter is a <strong>deployable Wonder Weapon</strong>, not a one-round LMG. Equip it, then press Fire to plant an automated turret in front of you. It lasts 45 seconds, scans a 140° horizontal arc, tracks enemies above and below it, and shoots targets in line of sight. Explosives and melee attacks can destroy it. You get one rechargeable deployment charge rather than conventional magazine ammo.</p>
            </FaqItem>
            <FaqItem q="How do killstreaks work?">
              <p>Each elimination grants another <strong>five seconds to earn the next kill</strong>. The streak only ends when you go more than five seconds without a kill or you die. For example, a ten-kill streak can span nine successive five-second intervals rather than fitting all ten kills into five seconds.</p>
            </FaqItem>
            <FaqItem q="What do the handling stats mean?">
              <p>Each weapon card shows these stats:</p>
              <div className="mt-2 space-y-1 text-xs">
                <StatLine label="HIP" desc="Standing hipfire accuracy — lower dispersion produces a higher %. Movement and sustained firing make shots less accurate." />
                <StatLine label="ADS" desc="Steady aimed accuracy — higher % = tighter while aiming. ADS reduces spread but does not eliminate it." />
                <StatLine label="RECOIL" desc="Camera kick per shot — lower is steadier. Automatic fire also accumulates temporary accuracy bloom." />
                <StatLine label="ADS-t" desc="Time to aim down sights (seconds) — lower is faster." />
                <StatLine label="HS×" desc="Headshot damage multiplier — 1.5× means a headshot does 50% more damage." />
                <StatLine label="MOVE" desc="Movement speed while holding this weapon — higher is faster." />
                <StatLine label="RANGE" desc="Effective range in meters. Beyond this, weapon-specific damage falloff applies until maximum hit distance." />
              </div>
            </FaqItem>
            <FaqItem q="What sights are available?">
              <p>Sight attachments change your zoom level and reticle. Available types:</p>
              <ul className="space-y-0.5 mt-1.5 text-xs">
                <li><strong>Iron Sight:</strong> Default — no magnification, fast ADS.</li>
                <li><strong>Red Dot / Holographic:</strong> 1× — clean reticle, tightens ADS spread.</li>
                <li><strong>Laser Sight:</strong> Iron sight + visible laser indicator. Tightens hipfire dramatically.</li>
                <li><strong>ACOG 4x:</strong> 4× magnification — mid-range precision, slower ADS.</li>
                <li><strong>Thermal 2x:</strong> 2× magnification + amber thermal overlay.</li>
                <li><strong>NVG Scope:</strong> 1.5× night vision with green tint.</li>
                <li><strong>Hunter 6x:</strong> 6× magnification — sniper-grade, very slow ADS.</li>
              </ul>
            </FaqItem>
          </Accordion>
        </FaqSection>

        {/* Rooms & Multiplayer */}
        <FaqSection icon={<Users className="w-5 h-5 text-amber-400" />} title="Rooms & Multiplayer">
          <Accordion type="single" collapsible className="space-y-2">
            <FaqItem q="How do I create a room?">
              <p>Go to <strong>Play → Create a Room</strong>. Choose your game mode (FFA/TDM/Kill Confirmed/Survival/Gun Game), team size (3v3/5v5/7v7), map, bot difficulty, whether to fill empty slots with bots, and an optional room name and password. Click <strong>Create Room</strong> — you&rsquo;ll enter a lobby state where you can wait for friends to join before starting.</p>
            </FaqItem>
            <FaqItem q="How do teams work?">
              <p>In <strong>TDM and Kill Confirmed</strong>, players pick Red or Blue team when joining (or auto-assign). Teams are balanced — each team has a size limit based on the room&rsquo;s team size setting (3v3, 5v5, or 7v7). If &ldquo;fill with bots&rdquo; is on, bots fill empty slots on both teams. When a human joins a full team, a bot is removed to make room (team size is respected).</p>
              <p className="mt-2">In <strong>FFA</strong>, there are no teams — everyone is an enemy. The team size selector becomes &ldquo;player slots&rdquo; (e.g., 5v5 = 10 total players).</p>
              <p className="mt-2">In <strong>Survival</strong>, all humans are on the same side against the bot waves.</p>
            </FaqItem>
            <FaqItem q="What does 'Fill with Bots' do?">
              <p>When enabled, bots automatically fill empty slots in the match. As human players join, bots are replaced one-for-one (respecting team size limits in TDM or Kill Confirmed). If a human leaves, a bot refills their slot so the match stays populated. This ensures the match is always full of combatants.</p>
            </FaqItem>
            <FaqItem q="What is bot difficulty and 'Mixed'?">
              <p>Bot difficulty is set per-room (not per-player) when creating a room:</p>
              <ul className="space-y-0.5 mt-1.5">
                <li><strong className="text-emerald-300">Easy:</strong> Slow reactions, frequent misses, loose bursts.</li>
                <li><strong className="text-yellow-300">Normal:</strong> Balanced — recommended for new players.</li>
                <li><strong className="text-orange-300">Hard:</strong> Quick reflexes, tighter bursts, fewer misses.</li>
                <li><strong className="text-red-300">Veteran:</strong> Snap aim, controlled spray, high accuracy.</li>
                <li><strong className="text-purple-300">Mixed:</strong> Each bot rolls a random difficulty — unpredictable!</li>
              </ul>
              <p className="mt-2">Higher difficulty bots award more XP and credits per kill. Enemy human players always award the same as a veteran bot.</p>
            </FaqItem>
            <FaqItem q="How do passwords work?">
              <p>When creating a room, you can set an optional password. Players trying to join a password-protected room will see a password prompt — they must enter the correct password to join. Open rooms (no password) can be joined by anyone from the Room Browser.</p>
            </FaqItem>
          </Accordion>
        </FaqSection>

        {/* Achievements */}
        <FaqSection icon={<TrendingUp className="w-5 h-5 text-amber-400" />} title="Achievements & Challenges">
          <Accordion type="single" collapsible className="space-y-2">
            <FaqItem q="How do achievements work?">
              <p>Achievements are long-term milestones (e.g., &ldquo;Reach Level 10&rdquo;, &ldquo;Get 500 kills&rdquo;, &ldquo;Survive 10 waves&rdquo;). They award bonus XP and credits when completed. Achievements are separated into two categories:</p>
              <ul className="space-y-0.5 mt-1.5">
                <li><strong className="text-rose-300">PvP Achievements:</strong> Earned in FFA, TDM, Kill Confirmed, and Gun Game matches (kills, wins, headshots, multikills).</li>
                <li><strong className="text-emerald-300">PvE Achievements:</strong> Earned in Survival mode (waves survived, survival kills, reinforcements used).</li>
              </ul>
              <p className="mt-2">View your achievements on the <strong>Profile</strong> screen.</p>
            </FaqItem>
            <FaqItem q="What are daily, weekly, and elite challenges?">
              <p>Three tiers of rotating objectives with different scopes and reward sizes:</p>
              <ul className="space-y-0.5 mt-1.5">
                <li><strong className="text-amber-300">Daily Challenges:</strong> 3 rotating objectives that refresh every midnight. Quick goals like &ldquo;Get 25 kills&rdquo; or &ldquo;Win 3 matches&rdquo;. Shown on the home screen.</li>
                <li><strong className="text-purple-300">Weekly Challenges:</strong> 2 harder objectives that rotate every ISO week (Monday). Bigger goals + bigger rewards (1000–2000 XP, 200–400 credits). Same set for all players each week. Shown on the home screen below the daily challenges.</li>
                <li><strong className="text-purple-300">Elite Variants:</strong> Each daily or weekly challenge has a small chance (~15% daily, ~25% weekly) of being &ldquo;promoted&rdquo; to an Elite variant per player per period. Elite variants have 3× the goal and 3× the reward, marked with a purple/pink &ldquo;Elite&rdquo; badge. They still reset on the same schedule as their parent (daily elite resets daily, weekly elite resets weekly). Promotion is deterministic per player — you&rsquo;ll see the same elite quests on reload within the same day/week.</li>
              </ul>
              <p className="mt-2">All challenges auto-award their rewards the moment they&rsquo;re completed — no manual claim needed.</p>
            </FaqItem>
          </Accordion>
        </FaqSection>
      </main>

      <footer className="mt-auto border-t border-white/10 bg-black/40 py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-white/40">
          <span>VANGUARD OPS · Field Manual</span>
          <Button variant="ghost" size="sm" onClick={() => setScreen("menu")} className="text-white/50 hover:text-white text-xs">
            Back to Menu <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

function FaqSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-white font-bold tracking-wide uppercase text-sm">{title}</h2>
      </div>
      <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
        {children}
      </div>
    </section>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={q} className="border-white/10">
      <AccordionTrigger className="text-white font-semibold text-sm hover:no-underline hover:text-amber-300 transition-colors">
        {q}
      </AccordionTrigger>
      <AccordionContent className="text-white/60 text-sm leading-relaxed">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

function RewardRow({ label, xp, cr, color }: { label: string; xp: string; cr: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-white/70 flex-1 truncate">{label}</span>
      <span className="text-amber-300 font-mono">{xp}</span>
      <span className="text-amber-300/60 font-mono">·</span>
      <span className="text-amber-300 font-mono">{cr}</span>
    </div>
  );
}

function StatLine({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-mono text-amber-300 font-bold shrink-0 w-14">{label}</span>
      <span className="text-white/60">{desc}</span>
    </div>
  );
}
