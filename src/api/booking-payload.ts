export type BookingCategory = 'Video call' | 'Phone call' | 'On-site';

export const LANGUAGE_LABELS = {
  en: {
    bookingTitle: (category: BookingCategory) => `Globetrotter booking: ${category}`,
    bookingDescription: (context: string) => `Globetrotter booking details: ${context || 'customer'}.`,
  },
  de: {
    bookingTitle: (category: BookingCategory) => `Globetrotter Buchung: ${translateCategory(category, 'de')}`,
    bookingDescription: (context: string) => `Globetrotter Buchungsdetails: ${context || 'Kunde'}.`,
  },
  fr: {
    bookingTitle: (category: BookingCategory) => `Reservation Globetrotter : ${translateCategory(category, 'fr')}`,
    bookingDescription: (context: string) => `Details de reservation Globetrotter : ${context || 'client'}.`,
  },
  it: {
    bookingTitle: (category: BookingCategory) => `Prenotazione Globetrotter: ${translateCategory(category, 'it')}`,
    bookingDescription: (context: string) => `Dettagli prenotazione Globetrotter: ${context || 'cliente'}.`,
  },
} as const;

export function buildBookingPayload(input: {
  bookingCategory: BookingCategory;
  bookingDate: string;
  bookingTime: string;
  customerName: string;
  emailAddress: string;
  phoneNumber: string;
  selectedSkillId: string;
  selectedSkillName: string;
}) {
  const slotId = `new-gt-${input.bookingDate}-${input.bookingTime.replace(':', '')}`;
  const customProperties: Record<string, string> = {
    meetingType: input.bookingCategory,
  };

  if (input.customerName.trim()) {
    customProperties['customerName'] = input.customerName.trim();
  }
  if (input.emailAddress.trim()) {
    customProperties['emailAddress'] = input.emailAddress.trim();
  }
  if (input.phoneNumber.trim()) {
    customProperties['phoneNumber'] = input.phoneNumber.trim();
  }
  if (input.selectedSkillId.trim()) {
    customProperties['destinationSkill'] = input.selectedSkillId.trim();
  }

  const descriptionBase = buildBookingDescription(input.bookingCategory, input.customerName, input.selectedSkillName);
  return {
    slots: {
      [slotId]: {
        dateFrom: input.bookingDate,
        dateTo: null,
        data: {
          text: LANGUAGE_LABELS.en.bookingTitle(input.bookingCategory),
          description: LANGUAGE_LABELS.en.bookingDescription(descriptionBase),
          translations: {
            en: {
              text: LANGUAGE_LABELS.en.bookingTitle(input.bookingCategory),
              description: LANGUAGE_LABELS.en.bookingDescription(descriptionBase),
            },
            de: {
              text: LANGUAGE_LABELS.de.bookingTitle(input.bookingCategory),
              description: LANGUAGE_LABELS.de.bookingDescription(descriptionBase),
            },
            fr: {
              text: LANGUAGE_LABELS.fr.bookingTitle(input.bookingCategory),
              description: LANGUAGE_LABELS.fr.bookingDescription(descriptionBase),
            },
            it: {
              text: LANGUAGE_LABELS.it.bookingTitle(input.bookingCategory),
              description: LANGUAGE_LABELS.it.bookingDescription(descriptionBase),
            },
          },
          icon: bookingIconByCategory(input.bookingCategory),
          isAllDay: false,
          startTime: input.bookingTime,
          endTime: addMinutes(input.bookingTime, 15),
          customProperties,
        },
      },
    },
  };
}

export function buildBookingDescription(category: BookingCategory, customerName: string, selectedSkillName: string): string {
  const parts = [customerName.trim() || 'customer'];
  if (selectedSkillName.trim()) {
    parts.push(selectedSkillName.trim());
  }
  parts.push(category);
  return parts.join(' - ');
}

export function translateCategory(category: BookingCategory, language: 'de' | 'fr' | 'it'): string {
  if (language === 'de') {
    if (category === 'Video call') return 'Videoanruf';
    if (category === 'Phone call') return 'Telefonanruf';
    return 'Vor Ort';
  }
  if (language === 'fr') {
    if (category === 'Video call') return 'Appel video';
    if (category === 'Phone call') return 'Appel telephonique';
    return 'Sur site';
  }
  if (category === 'Video call') return 'Videochiamata';
  if (category === 'Phone call') return 'Telefonata';
  return 'In sede';
}

export function bookingIconByCategory(category: BookingCategory): string {
  if (category === 'Phone call') {
    return 'phone';
  }
  if (category === 'On-site') {
    return 'location_on';
  }
  return 'videocam';
}

export function addMinutes(time: string, minutes: number): string {
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const baseMinutes = Number(minutesRaw);
  const totalMinutes = hours * 60 + baseMinutes + minutes;
  const nextHours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
  const nextMinutes = String(totalMinutes % 60).padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}
