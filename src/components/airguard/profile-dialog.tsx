'use client';

/**
 * Household profile dialog: drives personalisation of advisories, AI chat
 * and the daily plan. Stored only in localStorage; sent to the server as
 * validated, non-identifying fields.
 *
 * The form is a child of DialogContent, which Radix unmounts on close —
 * so its state re-initialises from props on every open (no sync effects).
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp, type FamilyProfile } from '@/components/airguard/state';
import { COMMUTE_LABELS, COOKING_FUEL_LABELS } from '@/lib/profile-schema';
import type { ProfileValue } from '@/lib/validators';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 10);
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: ProfileValue;
  onSaved: (next: ProfileValue) => void;
}) {
  const [draft, setDraft] = useState<ProfileValue>(profile);
  const [adults, setAdults] = useState(String(profile.adults));
  const [children, setChildren] = useState(String(profile.children));
  const [seniors, setSeniors] = useState(String(profile.seniors));

  function save() {
    onSaved({
      ...draft,
      adults: parseCount(adults),
      children: parseCount(children),
      seniors: parseCount(seniors),
    });
  }

  const toggle = (
    key: keyof Pick<
      FamilyProfile,
      'respiratoryConditions' | 'outdoorWork' | 'hasPurifier'
    >,
    label: string,
    hint: string,
    id: string,
  ) => (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3" key={key}>
      <div className="min-w-0">
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={draft[key]}
        onCheckedChange={(checked) => setDraft((d) => ({ ...d, [key]: checked }))}
        aria-label={label}
      />
    </div>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="profile-adults">Adults</Label>
          <Input
            id="profile-adults"
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            value={adults}
            onChange={(e) => setAdults(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="profile-children">Children under 12</Label>
          <Input
            id="profile-children"
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            value={children}
            onChange={(e) => setChildren(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="profile-seniors">Seniors over 60</Label>
          <Input
            id="profile-seniors"
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            value={seniors}
            onChange={(e) => setSeniors(e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      {toggle(
        'respiratoryConditions',
        'Asthma or respiratory condition at home',
        'Adds medication reminders and stricter protection advice.',
        'profile-respiratory',
      )}
      {toggle(
        'outdoorWork',
        'Someone works outdoors',
        'Delivery, vending, construction, farming, traffic duty.',
        'profile-outdoor',
      )}
      {toggle(
        'hasPurifier',
        'We have an air purifier',
        'Personalises filtration and ventilation guidance.',
        'profile-purifier',
      )}

      <div className="rounded-lg border p-3">
        <Label htmlFor="profile-commute">Main commute mode</Label>
        <Select
          value={draft.commuteMode}
          onValueChange={(value) =>
            setDraft((d) => ({
              ...d,
              commuteMode: value as ProfileValue['commuteMode'],
            }))
          }
        >
          <SelectTrigger
            id="profile-commute"
            className="mt-1.5 min-h-11 w-full"
            aria-label="Main commute mode"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COMMUTE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border p-3">
        <Label htmlFor="profile-fuel">Main cooking fuel</Label>
        <Select
          value={draft.cookingFuel}
          onValueChange={(value) =>
            setDraft((d) => ({
              ...d,
              cookingFuel: value as ProfileValue['cookingFuel'],
            }))
          }
        >
          <SelectTrigger
            id="profile-fuel"
            className="mt-1.5 min-h-11 w-full"
            aria-label="Main cooking fuel"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COOKING_FUEL_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={() => onSaved(profile)} className="min-h-11">
          Cancel
        </Button>
        <Button type="submit" className="min-h-11">
          Save profile
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { profile, setProfile } = useApp();

  function handleSaved(next: ProfileValue) {
    const changed = JSON.stringify(next) !== JSON.stringify(profile);
    setProfile(next);
    onOpenChange(false);
    if (changed) {
      toast.success('Household profile saved — advice is now personalised.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your household</DialogTitle>
          <DialogDescription>
            Used only to tailor guidance. Nothing here identifies you, and the
            data never leaves this device except as anonymous settings with the
            assistant requests.
          </DialogDescription>
        </DialogHeader>
        <ProfileForm profile={profile} onSaved={handleSaved} />
      </DialogContent>
    </Dialog>
  );
}
