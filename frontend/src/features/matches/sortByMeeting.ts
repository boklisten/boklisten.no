interface MeetingOrdered {
  meetingLocation: string;
  meetingTime: string | null;
}

export function compareByMeeting(a: MeetingOrdered, b: MeetingOrdered): number {
  if (a.meetingTime !== b.meetingTime) {
    if (a.meetingTime === null) {
      return 1;
    }
    if (b.meetingTime === null) {
      return -1;
    }
    // ISO timestamps sort correctly as strings.
    if (a.meetingTime < b.meetingTime) {
      return -1;
    }
    if (a.meetingTime > b.meetingTime) {
      return 1;
    }
  }
  return a.meetingLocation.localeCompare(b.meetingLocation, "nb", { numeric: true });
}

export function sortByMeeting<T extends MeetingOrdered>(matches: readonly T[]): T[] {
  return [...matches].toSorted(compareByMeeting);
}
