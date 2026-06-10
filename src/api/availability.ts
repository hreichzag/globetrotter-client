import type { AvailabilityResponse } from '../types';
import type { BookingCategory } from './booking-payload';

const ALL_BOOKING_CATEGORIES: BookingCategory[] = ['Video call', 'Phone call', 'On-site'];

/**
 * Default 15-minute time grid used when availability data hasn't been loaded yet.
 * Once availability IS loaded, only the slots actually returned by the server are shown.
 */
function generateDefault15MinSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 7; hour < 19; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return slots;
}

export const DEFAULT_TIME_SLOTS = generateDefault15MinSlots();

export function getAvailableBookingTimes(
  availability: AvailabilityResponse | null,
  selectedPersonId: string,
  bookingDate: string
): string[] {
  if (!selectedPersonId || !bookingDate) {
    return [];
  }

  if (!availability) {
    return DEFAULT_TIME_SLOTS;
  }

  const personEntry = availability.data.find(person => person.personId === selectedPersonId);
  if (!personEntry) {
    return [];
  }

  const dateEntry = personEntry.dates.find(date => date.date === bookingDate);
  if (!dateEntry || dateEntry.slots.length === 0) {
    return [];
  }

  return [...new Set(dateEntry.slots.map(slot => slot.startTime).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

/**
 * Derive the available meeting types (categories) for a specific slot based on what
 * the availability endpoint returned. Falls back to all categories when no data is loaded.
 */
export function getAvailableCategoriesForSlot(
  availability: AvailabilityResponse | null,
  selectedPersonId: string,
  bookingDate: string,
  bookingTime: string
): BookingCategory[] {
  if (!selectedPersonId || !bookingDate || !bookingTime) {
    return [];
  }

  if (!availability) {
    return ALL_BOOKING_CATEGORIES;
  }

  const personEntry = availability.data.find(person => person.personId === selectedPersonId);
  if (!personEntry) {
    return [];
  }

  const dateEntry = personEntry.dates.find(date => date.date === bookingDate);
  if (!dateEntry) {
    return [];
  }

  const matchingSlot = dateEntry.slots.find(slot => slot.startTime === bookingTime);
  if (!matchingSlot || !matchingSlot.categories || matchingSlot.categories.length === 0) {
    return [];
  }

  return matchingSlot.categories.filter((category): category is BookingCategory =>
    ALL_BOOKING_CATEGORIES.includes(category as BookingCategory)
  );
}
