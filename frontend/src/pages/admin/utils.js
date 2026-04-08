export const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

export const getAvatarStyle = (index) => {
  const variants = ['bgAmber', 'bgTeal', 'bgBlue'];
  return variants[index % variants.length];
};
