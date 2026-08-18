import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Wordmark from '../components/Wordmark.jsx';
import Reveal from '../components/Reveal.jsx';
import Button from '../components/ui/Button.jsx';
import { Badge, Eyebrow } from '../components/ui/Surface.jsx';
import Icon from '../components/Icon.jsx';
import { readableOn } from '../lib/color.js';
import { SAMPLE } from '../lib/sample.js';
import { PLAN_CATALOG } from '../lib/plans.js';
import { useAuth } from '../lib/authContext.js';

const NAV = [
  { label: 'How it works', href: '#how' },
  { label: 'What you get', href: '#craft' },
  { label: 'Pricing', href: '#pricing' },
];

const STEPS = [
  {
    n: '01',
    icon: Icon.Upload,
    title: 'Upload one photo',
    body: 'A single frame of the room as it stands. No staging, no cleanup, no measurements.',
  },
  {
    n: '02',
    icon: Icon.Sparkle,
    title: 'The room is read',
    body: 'Light, proportion, materials, and the existing palette are assessed the way a designer would on a first walkthrough.',
  },
  {
    n: '03',
    icon: Icon.Compare,
    title: 'A direction returns',
    body: 'A full board - plus a render of your actual room, restyled from the same viewpoint.',
  },
];

const CRAFT = [
  {
    icon: Icon.Palette,
    title: 'A palette from the room',
    body: 'Four to six real hex values pulled from what the light in your space is already doing.',
  },
  {
    icon: Icon.Layout,
    title: 'Keep, remove, add',
    body: 'Every piece accounted for, with the reasoning - not a wishlist of furniture you do not own.',
  },
  {
    icon: Icon.Materials,
    title: 'Materials and finishes',
    body: 'Named surfaces and where each one goes, so the direction is buildable rather than aspirational.',
  },
  {
    icon: Icon.Lighting,
    title: 'A lighting plan',
    body: 'Colour temperature, layers, and what to replace first - usually the cheapest real change.',
  },
  {
    icon: Icon.Shopping,
    title: 'A shopping list',
    body: 'Priced by tier against the budget you set, so the plan stays inside it.',
  },
  {
    icon: Icon.Photo,
    title: 'A render of your room',
    body: 'Your photograph edited into the new direction - same walls, same windows, same camera.',
  },
];

export default function Landing() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const primaryTo = user ? '/app' : '/signup';
  const primaryLabel = user ? 'Open dashboard' : 'Start free';

  return (
    <div className="min-h-screen bg-canvas">
      {/* - Nav --------------------------------------------- */}
      <header
        className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
          scrolled
            ? 'border-line bg-canvas/85 backdrop-blur-md'
            : 'border-transparent bg-canvas'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Wordmark />

          <nav className="hidden items-center gap-8 md:flex" aria-label="Sections">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <Button as={Link} to="/app" size="sm" iconRight={Icon.ArrowRight}>
                Dashboard
              </Button>
            ) : (
              <>
                <Button as={Link} to="/signin" variant="ghost" size="sm">
                  Sign in
                </Button>
                <Button as={Link} to="/signup" size="sm">
                  Start free
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="rounded-[8px] p-2 text-ink transition-colors hover:bg-surface md:hidden"
          >
            {menuOpen ? <Icon.Close size={20} /> : <Icon.Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div className="hd-fade border-t border-line bg-canvas px-5 py-4 md:hidden">
            <nav className="flex flex-col" aria-label="Sections">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-line py-3 text-sm text-ink-2"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              {user ? (
                <Button as={Link} to="/app" full>
                  Open dashboard
                </Button>
              ) : (
                <>
                  <Button as={Link} to="/signup" full>
                    Start free
                  </Button>
                  <Button as={Link} to="/signin" variant="secondary" full>
                    Sign in
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* - Hero ----------------------------------------- */}
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-20">
          <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-12">
            <div className="hd-rise lg:col-span-6">
              <Badge tone="accent" icon={Icon.Sparkle}>
                Room analysis by Claude
              </Badge>

              <h1 className="mt-6 font-display text-hero font-semibold text-ink">
                See your room the way a designer already sees it.
              </h1>

              <p className="text-lead mt-6 max-w-lg text-muted">
                Upload one photo. Get back a considered direction - palette,
                materials, light, a keep-and-replace plan - and a render of the
                same room, redesigned.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button as={Link} to={primaryTo} size="lg" iconRight={Icon.ArrowRight}>
                  {primaryLabel}
                </Button>
                <Button as="a" href="#how" variant="secondary" size="lg">
                  See how it works
                </Button>
              </div>

              <p className="mt-5 text-sm text-muted">
                Free account · 500 MB included · about a minute per room
              </p>
            </div>

            {/* The product output itself, as the hero image. */}
            <div
              className="hd-rise lg:col-span-6"
              style={{ animationDelay: '110ms' }}
            >
              <BoardPreview />
            </div>
          </div>
        </section>

        {/* - How it works --------------------------------- */}
        <section
          id="how"
          className="scroll-mt-20 border-t border-line bg-surface py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Eyebrow tone="accent">How it works</Eyebrow>
            <h2 className="mt-3 max-w-2xl font-display text-display font-semibold text-ink">
              One photo in. A complete direction out.
            </h2>

            <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step, i) => (
                <Reveal key={step.n} delay={i * 90}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-canvas text-accent">
                      <step.icon size={19} />
                    </span>
                    <span className="font-mono text-xs text-faint tnum">{step.n}</span>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* - What you get --------------------------------- */}
        <section id="craft" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <Eyebrow tone="accent">What you get</Eyebrow>
              <h2 className="mt-3 font-display text-display font-semibold text-ink">
                Six things on every board.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted">
                Not mood-board vagueness. Specific, grounded decisions about the
                room in the photograph you sent.
              </p>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {CRAFT.map((item, i) => (
                <Reveal
                  key={item.title}
                  delay={(i % 3) * 70}
                  className="bg-canvas p-6 sm:p-7"
                >
                  <span className="text-accent">
                    <item.icon size={21} />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* - Pricing --------------------------------------- */}
        <section
          id="pricing"
          className="scroll-mt-20 border-t border-line bg-surface py-20 sm:py-28"
        >
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <Eyebrow tone="accent">Pricing</Eyebrow>
              <h2 className="mt-3 font-display text-display font-semibold text-ink">
                Start free. Upgrade when you run out of room.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted">
                Every account gets the full studio. The only thing a plan changes
                is how much of your work you can keep.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {PLAN_CATALOG.map((plan) => (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-[16px] border bg-canvas p-7 ${
                    plan.featured ? 'border-ink' : 'border-line'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-semibold text-ink">
                      {plan.name}
                    </h3>
                    {plan.featured && (
                      <Badge tone="accent" icon={Icon.Pro}>
                        Most storage
                      </Badge>
                    )}
                  </div>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="font-display text-4xl font-semibold tracking-tight text-ink tnum">
                      {plan.price}
                    </span>
                    <span className="text-sm text-muted">{plan.period}</span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-muted">{plan.blurb}</p>

                  <ul className="mt-7 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm text-ink-2">
                        <span className="mt-0.5 shrink-0 text-accent">
                          <Icon.Check size={16} />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    as={Link}
                    to={user ? (plan.id === 'pro' ? '/app/storage' : '/app') : '/signup'}
                    variant={plan.featured ? 'primary' : 'secondary'}
                    className="mt-8"
                    full
                  >
                    {plan.cta}
                  </Button>
                </div>
              ))}
            </div>

            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
              <Icon.Shield size={14} />
              Your photos and boards are private to your account.
            </p>
          </div>
        </section>

        {/* - Close ----------------------------------------- */}
        <section className="border-t border-line py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <h2 className="font-display text-display font-semibold text-ink">
              Point a camera at the room you keep meaning to fix.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              That is the whole setup. A minute later you will have a direction
              worth acting on.
            </p>
            <div className="mt-8 flex justify-center">
              <Button as={Link} to={primaryTo} size="lg" iconRight={Icon.ArrowRight}>
                {primaryLabel}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Wordmark size="sm" />
          <p className="max-w-md text-xs leading-relaxed text-muted">
            The before is your photograph. The after is an AI render of the same
            room redesigned, alongside a written direction. Room analysis by
            Claude; render by gpt-image-1.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* - The hero visual: a real board, rendered from real data ----------- */

function BoardPreview() {
  return (
    <figure className="overflow-hidden rounded-[16px] border border-line bg-canvas">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2 text-muted">
          <Icon.Photo size={16} />
          <span className="text-xs font-medium text-ink-2">{SAMPLE.roomType}</span>
        </div>
        <span className="text-eyebrow font-semibold uppercase text-muted">
          {SAMPLE.style}
        </span>
      </div>

      <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        <p className="font-display text-lg leading-snug text-ink sm:text-xl">
          {SAMPLE.concept}
        </p>

        <div className="mt-5 flex overflow-hidden rounded-[10px] border border-line">
          {SAMPLE.palette.map((color) => (
            <div
              key={color.hex}
              className="flex h-20 flex-1 items-end p-2 sm:h-24"
              style={{ backgroundColor: color.hex, color: readableOn(color.hex) }}
              title={`${color.name} · ${color.hex}`}
            >
              <span className="font-mono text-[10px] uppercase opacity-70">
                {color.hex}
              </span>
            </div>
          ))}
        </div>

        <ul className="mt-5 space-y-3">
          {SAMPLE.lines.map((line) => (
            <li key={line.text} className="flex gap-3 text-sm leading-relaxed">
              <span className="w-11 shrink-0 pt-px text-eyebrow font-semibold uppercase text-accent">
                {line.action}
              </span>
              <span className="text-ink-2">{line.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
