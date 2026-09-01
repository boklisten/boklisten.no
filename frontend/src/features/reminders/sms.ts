const SMS_MAX_SINGLE_SEGMENT_LENGTH = 160;
const SMS_MAX_MULTIPLE_SEGMENT_LENGTH = 153;

export function calculateSmsSegmentFeedback(smsText: string) {
  const { length } = smsText;
  if (length <= SMS_MAX_SINGLE_SEGMENT_LENGTH) {
    const extraChars =
      length === SMS_MAX_SINGLE_SEGMENT_LENGTH
        ? SMS_MAX_SINGLE_SEGMENT_LENGTH
        : length % SMS_MAX_SINGLE_SEGMENT_LENGTH;
    return `1 segment, ${extraChars}/${SMS_MAX_SINGLE_SEGMENT_LENGTH} til neste`;
  } else {
    const segments = Math.ceil(length / SMS_MAX_MULTIPLE_SEGMENT_LENGTH);
    const extraChars = length % SMS_MAX_MULTIPLE_SEGMENT_LENGTH;
    return `${segments} segmenter, ${extraChars}/${SMS_MAX_MULTIPLE_SEGMENT_LENGTH} til neste`;
  }
}
