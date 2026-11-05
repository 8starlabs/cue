const containerIdPattern = /^GTM-[A-Z0-9]+$/;

export function getGoogleTagManagerId(value: string | undefined) {
  return value && containerIdPattern.test(value) ? value : undefined;
}
