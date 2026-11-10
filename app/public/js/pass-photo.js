// Puts the recruit's selfie on their pass card, like a real building pass: the photo in a green
// frame with their full name underneath. Used by the home screen, the welcome screen and photo.html.
//   showPassPhoto(document.getElementById('pass'), { src, name })   // src: an image URL or data URL
//   passPhotoUrl(journey)  // the recruit's saved photo, or null

export const passPhotoUrl = (j) => (j?.photo?.has ? `/api/journey/photo?v=${encodeURIComponent(j.photo.updatedAt)}` : null);

export function showPassPhoto(pass, { src, name }) {
  let fig = pass.querySelector('.pass-photo');
  if (!src) { fig?.remove(); pass.classList.remove('has-photo'); return; }
  if (!fig) {
    fig = document.createElement('figure');
    fig.className = 'pass-photo';
    fig.append(Object.assign(document.createElement('img'), { alt: '' }), document.createElement('figcaption'));
    pass.append(fig);
  }
  fig.querySelector('img').src = src;
  fig.querySelector('figcaption').textContent = name;
  pass.classList.add('has-photo');
}
