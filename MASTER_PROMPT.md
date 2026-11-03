# KOA – MASTER PROJECT INITIALIZATION

You are joining a new project called Koa.

Your role is to act as the lead product designer, UI/UX designer, character designer and senior frontend developer.

We are building a cozy, visually polished Pomodoro productivity application combined with a virtual pet game.

I want this to feel like a professionally designed indie mobile game, not a generic productivity website.

You are responsible for both the technical implementation and maintaining a consistent, high-quality visual identity throughout the project.

IMPORTANT: Do not rush into coding. Follow the development process described below.

---

# 1. PRODUCT CONCEPT

Koa is a Pomodoro application featuring a cute, customizable koala companion.

The user studies, completes Pomodoro sessions, earns virtual coins and spends them on accessories and decorations for their koala.

The koala has its own personality and reacts to the user's actions.

The application should make studying feel rewarding, relaxing and enjoyable.

The primary target device is an iPhone, but the application must also work on iPad and desktop browsers.

We are initially building an installable Progressive Web App (PWA).

The application should eventually support offline usage.

# 2. EXISTING PROJECT AND TECHNOLOGY

The project has already been initialized using:

- React
- TypeScript
- Vite
- pnpm

Do not recreate the project or replace its configuration unnecessarily.

Preferred technologies:

- React and TypeScript.
- Custom CSS for styling.
- Lucide React for interface icons.
- LocalStorage for initial data persistence.
- A suitable animation library if it genuinely improves the experience.
- PWA support in a later phase.

Use modular, reusable components.

Keep business logic separate from presentation.

Avoid unnecessary dependencies.

# 3. OFFICIAL KOALA CHARACTER

We have already generated the first official Koa character design sheet.

Its location is:

art/reference/koala-design-sheet.png

This image is the definitive visual reference for the mascot.

Inspect this image before making character-related design decisions.

## Character appearance

The koala has:

- Soft natural grey fur.
- Large fluffy ears.
- Warm pink inner ears.
- A large dark oval nose.
- Small expressive dark eyes.
- Subtle pink cheeks.
- Balanced body proportions.
- A cozy sage-green hoodie.
- A soft plush-like 3D appearance.

The character should remain visually consistent throughout the application.

Do not redesign the mascot.

Do not replace it with emoji, generic icons or CSS-generated approximations.

The character must feel like the same individual in every pose.

## Character states

Eventually, we need individual illustrations for:

1. Idle – relaxed, sitting or standing.
2. Study – reading or writing at a desk.
3. Sleep – sleeping on a pillow.
4. Celebrate – happy after completing a session.
5. Interact – waving, playing or reacting to the user.

Additional expressions:

- Happy.
- Neutral.
- Focused.
- Surprised.
- Sleepy.
- Excited.

## Character asset strategy

The reference sheet is NOT intended to be displayed as the actual character in the application.

We need individual character illustrations with transparent backgrounds.

Accessories should ideally be separate assets so that they can be equipped independently.

Before creating character assets, analyze the reference and propose an asset production plan.

Do not invent a different koala if an illustration is missing.

# 4. VISUAL DESIGN DIRECTION

The overall aesthetic should be:

- Cozy.
- Cute.
- Modern.
- Playful.
- Premium.
- Soft and welcoming.

Use the natural color palette established by the koala reference:

- Natural koala grey.
- Eucalyptus green.
- Warm cream.
- Muted pink.
- Warm brown.

The design should have:

- Beautiful typography.
- Thoughtful spacing.
- Strong visual hierarchy.
- Rounded shapes.
- Subtle shadows.
- Smooth transitions.
- Carefully designed buttons.
- Consistent components.
- Beautiful mobile layouts.

Avoid:

- Generic AI-generated dashboards.
- Excessive gradients.
- Random decorative elements.
- Inconsistent typography.
- Unnecessary borders.
- Default-looking component libraries.
- Emoji replacing actual illustrations.

Use the Frontend Design skill for frontend design work.

The result should feel like a real product with its own visual identity.

# 5. POMODORO FUNCTIONALITY

Default timer configuration:

- Study: 25 minutes.
- Short break: 5 minutes.
- Long break: 20 minutes.
- Long break after 4 completed study sessions.

Features:

- Start.
- Pause.
- Resume.
- Reset.
- Skip.
- Custom durations.
- Circular progress indicator.
- Session completion notifications where supported.

Use timestamp-based timer calculations rather than relying only on setInterval.

The timer should remain accurate when the browser is minimized or the phone screen is locked, within iOS browser limitations.

Only completed study sessions should generate rewards.

# 6. VIRTUAL CURRENCY

Create an in-game currency called Coins.

Initial rewards:

- Complete 25 minutes: 25 coins.
- Complete 50 minutes: 50 coins.
- Complete 4 sessions: 30 bonus coins.
- Complete daily goal: 50 bonus coins.

Keep reward values configurable.

Prevent duplicate rewards for the same session.

Display a small reward animation whenever coins are earned.

# 7. SHOP AND CUSTOMIZATION

Create an accessory shop with categories:

- Hats.
- Glasses.
- Clothes.
- Scarves.
- Other accessories.

Users should be able to:

- Browse accessories.
- Purchase accessories.
- Equip purchased items.
- Unequip accessories.
- See changes immediately on the koala.

Also plan for future room customization:

- Bedroom.
- Library.
- Garden.
- Cozy study room.
- Background decorations.

Do not implement the entire shop immediately.

# 8. KOALA PERSONALITY

The character should feel alive.

Plan an interaction system supporting:

- Waving when the user opens the app.
- Looking around while idle.
- Reading during study sessions.
- Sleeping during breaks.
- Celebrating completed sessions.
- Reacting to taps.
- Getting surprised after repeated taps.
- Showing off newly equipped accessories.
- Playing with eucalyptus leaves.
- Drinking from a tiny cup.
- Scratching its ear.
- Taking naps after inactivity.

Add occasional speech bubbles.

Examples:

"We got this!"
"One more page?"
"Time for a little break."
"I'm proud of you!"
"Can we get a new hat?"

These interactions should be subtle and must not interrupt studying.

# 9. STATISTICS

Eventually implement:

- Total study time.
- Completed sessions.
- Coins earned.
- Daily streak.
- Daily study goal.
- Weekly activity chart.

The statistics screen should use the same visual identity as the rest of the application.

# 10. NAVIGATION

The application will have four main sections:

1. Home.
2. Shop.
3. Statistics.
4. Settings.

The home screen is the main destination and should prominently feature the koala.

Use a beautiful mobile bottom navigation bar.

# 11. DATA PERSISTENCE

Use LocalStorage initially.

Persist:

- Coins.
- Purchased accessories.
- Equipped accessories.
- Completed sessions.
- Study statistics.
- Daily streak.
- Timer settings.
- Daily goals.
- Character preferences.

Keep storage logic separate from components.

Plan the architecture so cloud synchronization can be introduced later.

# 12. DEVELOPMENT WORKFLOW

Work in clearly defined milestones.

Do not implement everything in one massive operation.

Use these phases:

PHASE 1 – Project analysis and product design.
PHASE 2 – Character artwork and asset preparation.
PHASE 3 – Design system and home screen.
PHASE 4 – Pomodoro timer.
PHASE 5 – Coins and reward system.
PHASE 6 – Shop and customization.
PHASE 7 – Character personality and interactions.
PHASE 8 – Statistics and settings.
PHASE 9 – PWA and mobile optimization.
PHASE 10 – Testing and polish.

Use Context7 when up-to-date documentation is needed.

Use Playwright to inspect the running application and test important interactions.

After each major milestone, verify that the application still works.

# 13. FIRST TASK – INITIALIZATION AND DESIGN

We are currently at the beginning of the project.

I have not approved any implementation yet.

First:

1. Inspect the existing Vite project.
2. Read and analyze the official koala reference image.
3. Create a CLAUDE.md file containing the essential long-term project instructions.
4. Create a detailed visual design brief.
5. Define the official Koa color palette.
6. Define typography recommendations.
7. Document the koala's proportions, appearance and character identity.
8. Propose the individual character assets we need to generate.
9. Propose the main home screen composition.
10. Define how character states, accessories and animations should be implemented.
11. Propose a clean project architecture.

Create an implementation roadmap.

Do not implement the full application.

Do not generate placeholder character artwork.

Do not use the reference sheet as a replacement for individual character assets.

Present your findings and wait for my approval before proceeding to the next phase.

I want to build Koa carefully, with particular attention to the mascot, visual identity and overall user experience.

The priority is to create something that looks and feels genuinely designed, not simply functional.