'use client';

import React, { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/navbar';
import { Calendar, Zap, Award, CheckCircle, BarChart, ArrowRight, User } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface UserStats {
  bestWpm: number;
  avgWpm: number;
  avgAccuracy: number;
  testsCompleted: number;
  totalTimeSecs: number;
}

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  // Unpack Next 15 route params using React.use()
  const { username } = use(params);
  
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchPublicData() {
      try {
        const supabase = createClient();
        
        // 1. Fetch Profile
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, created_at')
          .eq('username', username)
          .single();

        if (profileErr || !profileData) {
          setNotFound(true);
          return;
        }
        setProfile(profileData);

        // 2. Fetch Test Results aggregations
        const { data: results, error: resultsErr } = await supabase
          .from('test_results')
          .select('wpm, accuracy, duration')
          .eq('user_id', profileData.id)
          .eq('is_invalidated', false);

        if (!resultsErr && results) {
          const wpmList = results.map((r: any) => r.wpm);
          const bestWpm = wpmList.length > 0 ? Math.max(...wpmList) : 0;
          const avgWpm = wpmList.length > 0 ? Math.round(wpmList.reduce((a: number, b: number) => a + b, 0) / wpmList.length) : 0;
          const avgAccuracy = results.length > 0 
            ? Math.round(results.map((r: any) => r.accuracy).reduce((a: number, b: number) => a + b, 0) / results.length) 
            : 0;
          const totalTimeSecs = results.reduce((a: number, b: any) => a + b.duration, 0);

          setStats({
            bestWpm,
            avgWpm,
            avgAccuracy,
            testsCompleted: results.length,
            totalTimeSecs,
          });
        }

        // 3. Fetch Streaks
        const { data: streakData } = await supabase
          .from('streaks')
          .select('current_streak, longest_streak')
          .eq('user_id', profileData.id)
          .single();
        if (streakData) {
          setStreak({
            current: streakData.current_streak,
            longest: streakData.longest_streak,
          });
        }

        // 4. Fetch achievements
        const { data: userAchievements } = await supabase
          .from('user_achievements')
          .select('unlocked_at, achievements(name, description, icon_path)')
          .eq('user_id', profileData.id);

        if (userAchievements) {
          setAchievements(userAchievements);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicData();
  }, [username]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-3 border-accent border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <h1 className="text-2xl font-bold text-text-primary">Profile Not Found</h1>
          <p className="text-text-secondary text-sm">The user u/{username} does not exist.</p>
          <Button href="/" variant="primary" className="mt-2">
            Return Home
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-12 flex flex-col gap-8">
        {/* User Card */}
        <div className="p-8 bg-surface border-3 border-border flex flex-col sm:flex-row items-center gap-6 shadow-sm">
          <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-10 h-10" />
            )}
          </div>

          <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-1">
            <h1 className="text-2xl font-extrabold text-text-primary">
              {profile.display_name || profile.username}
            </h1>
            <span className="text-xs text-text-secondary font-mono">u/{profile.username}</span>
            <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
              <Calendar className="w-3.5 h-3.5" />
              <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {streak && streak.current > 0 && (
            <div className="sm:ml-auto flex items-center gap-2 px-4 py-2 bg-bauhaus-yellow/15 border-3 border-bauhaus-yellow text-text-primary dark:text-bauhaus-yellow">
              <Zap className="w-5 h-5 fill-current" />
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold font-mono leading-none">{streak.current} Days</span>
                <span className="text-xs uppercase font-semibold">Active Streak</span>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard Numbers Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-6 bg-surface border-3 border-border flex flex-col">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Best Speed</span>
            <span className="text-3xl font-bold font-mono mt-2 text-accent">{stats?.bestWpm || 0} WPM</span>
          </div>
          <div className="p-6 bg-surface border-3 border-border flex flex-col">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Average Speed</span>
            <span className="text-3xl font-bold font-mono mt-2 text-text-primary">{stats?.avgWpm || 0} WPM</span>
          </div>
          <div className="p-6 bg-surface border-3 border-border flex flex-col">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Accuracy</span>
            <span className="text-3xl font-bold font-mono mt-2 text-text-primary">{stats?.avgAccuracy || 0}%</span>
          </div>
          <div className="p-6 bg-surface border-3 border-border flex flex-col">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Tests Run</span>
            <span className="text-3xl font-bold font-mono mt-2 text-text-primary">{stats?.testsCompleted || 0}</span>
          </div>
        </div>

        {/* Achievements list */}
        <div className="p-6 bg-surface border-3 border-border flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border/10 pb-4">
            <Award className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold text-text-primary">Achievements Unlocked</span>
          </div>

          {achievements.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-secondary">
              No achievements unlocked yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map((ach, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-background/50 border-3 border-border/50">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-text-primary">
                      {ach.achievements?.name || 'Badge'}
                    </span>
                    <span className="text-xs text-text-secondary mt-0.5">
                      {ach.achievements?.description || 'Unlocked achievement badge'}
                    </span>
                    <span className="text-xs text-text-secondary/80 mt-1">
                      Unlocked {new Date(ach.unlocked_at).toLocaleDateString()}
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
