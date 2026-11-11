import type { Metadata } from 'next';
import React from 'react';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { AchievementBadge } from '@/components/ui/achievement-badge';
import { getPublicProfileByUsername } from '@/lib/data/profile';
import { formatUtcDate } from '@/lib/utils/format-date';
import { Calendar, Zap, Award, Clock, Activity } from 'lucide-react';

interface PublicProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({
  params,
}: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const data = await getPublicProfileByUsername(username);

  if (!data) {
    return {
      title: 'Profile Not Found',
      description: 'This TyProX typist profile could not be found.',
    };
  }

  const display = data.profile.display_name || data.profile.username;
  return {
    title: `${display} (@${data.profile.username})`,
    description: `${display}'s verified typing stats on TyProX: ${data.stats.bestWpm} WPM personal best, ${data.stats.avgAccuracy}% accuracy across ${data.stats.testsCompleted} verified runs.`,
    openGraph: {
      title: `${display} · ${data.stats.bestWpm} WPM Best on TyProX`,
      description: `${data.stats.testsCompleted} verified typing tests completed with ${data.stats.avgAccuracy}% average accuracy.`,
      type: 'profile',
    },
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const data = await getPublicProfileByUsername(username);

  if (!data) {
    notFound();
  }

  const { profile, stats, streak, achievements, recentRuns } = data;
  const displayName = profile.display_name || profile.username;

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        {/* Profile Header Card */}
        <div className="p-6 md:p-8 bg-surface border border-border rounded-2xl flex flex-col sm:flex-row items-center gap-6 shadow-sm">
          <UserAvatar
            avatarUrl={profile.avatar_url}
            alt={displayName}
            size="lg"
          />

          <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-1">
            <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-text-primary">
              {displayName}
            </h1>
            <span className="text-xs text-text-secondary font-mono">
              u/{profile.username}
            </span>
            <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Joined {formatUtcDate(profile.created_at)}</span>
            </div>
          </div>

          <div className="sm:ml-auto flex flex-wrap items-center justify-center gap-3">
            {streak && streak.current > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/10 border border-warning/30 text-warning">
                <Zap className="w-4 h-4 fill-current" aria-hidden="true" />
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold font-mono leading-none tabular-nums">
                    {streak.current} Days
                  </span>
                  <span className="text-[11px] font-medium">Active Streak</span>
                </div>
              </div>
            )}

            <Button href="/typing" variant="primary" className="px-4 py-2 text-xs">
              Start Practice
            </Button>
          </div>
        </div>

        {/* Career Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 bg-surface border border-border rounded-2xl flex flex-col gap-1">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Best Speed
            </span>
            <span className="text-3xl font-bold font-mono mt-1 text-accent-ink tabular-nums">
              {stats.bestWpm} <span className="text-sm font-normal">WPM</span>
            </span>
          </div>
          <div className="p-5 bg-surface border border-border rounded-2xl flex flex-col gap-1">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Average Speed
            </span>
            <span className="text-3xl font-bold font-mono mt-1 text-text-primary tabular-nums">
              {stats.avgWpm} <span className="text-sm font-normal">WPM</span>
            </span>
          </div>
          <div className="p-5 bg-surface border border-border rounded-2xl flex flex-col gap-1">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Accuracy
            </span>
            <span className="text-3xl font-bold font-mono mt-1 text-success tabular-nums">
              {stats.avgAccuracy}%
            </span>
          </div>
          <div className="p-5 bg-surface border border-border rounded-2xl flex flex-col gap-1">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Verified Tests
            </span>
            <span className="text-3xl font-bold font-mono mt-1 text-text-primary tabular-nums">
              {stats.testsCompleted}
            </span>
          </div>
        </div>

        {/* Recent Verified Runs */}
        <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col gap-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent-ink" aria-hidden="true" />
              <h2 className="text-sm font-bold text-text-primary">
                Recent Verified Sessions
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{Math.round(stats.totalTimeSecs / 60)}m recorded</span>
            </div>
          </div>

          {recentRuns.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-secondary">
              No verified runs recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border"
                >
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-sm text-accent-ink tabular-nums">
                      {run.wpm} WPM
                    </span>
                    <span className="text-xs text-text-secondary capitalize">
                      {run.mode} ({run.duration}s)
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="font-mono font-semibold text-xs text-text-primary tabular-nums">
                      {run.accuracy}% acc
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatUtcDate(run.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unlocked Achievements */}
        <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col gap-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Award className="w-4 h-4 text-accent-ink" aria-hidden="true" />
            <h2 className="text-sm font-bold text-text-primary">
              Achievements Unlocked
            </h2>
          </div>

          {achievements.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-secondary">
              No achievements unlocked yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map((ach, idx) => (
                <div
                  key={`${ach.name}-${idx}`}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-background border border-border"
                >
                  <AchievementBadge iconPath={ach.icon_path} alt={ach.name} size={40} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-text-primary">
                      {ach.name}
                    </span>
                    <span className="text-xs text-text-secondary mt-0.5">
                      {ach.description}
                    </span>
                    <span className="text-[11px] text-text-secondary mt-1">
                      Unlocked {formatUtcDate(ach.unlocked_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
