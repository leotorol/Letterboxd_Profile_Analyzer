import './CinematicBackground.css';

/**
 * Cinematic space background with film-themed elements.
 *
 * Adds subtle cinema details to the space background:
 * film strip constellations, orbital celluloid, cosmic projector beam,
 * and frame-shaped stars.
 *
 * Returns:
 *   JSXElement: Background layer with cinematic elements.
 */
export default function CinematicBackground() {
  return (
    <>
      <div className="stars-layer-2" aria-hidden="true"></div>
      <div className="stars-layer-3" aria-hidden="true"></div>
      <div className="cinematic-bg-layer" aria-hidden="true">
      <div className="orbital-film-strip"></div>

      <div className="projector-beam">
        <div className="beam-particles"></div>
      </div>

      <svg className="camera-constellation" viewBox="0 0 200 160" aria-hidden="true">
        <g className="constellation-line">
          <circle cx="65" cy="43" r="22" />
          <circle cx="109" cy="43" r="22" />
          <rect x="40" y="65" width="90" height="55" />
          <path d="M 130 85 L 155 70 L 155 100 Z" />
        </g>
        <g className="constellation-stars">
          <circle cx="40" cy="65" r="1.5" />
          <circle cx="130" cy="65" r="1.5" />
          <circle cx="130" cy="120" r="1.5" />
          <circle cx="40" cy="120" r="1.5" />
          <circle cx="155" cy="70" r="1.5" />
          <circle cx="155" cy="100" r="1.5" />
        </g>
      </svg>

      <svg className="lbx-logo-constellation" viewBox="0 0 180 80" aria-hidden="true">
        <g className="constellation-line lbx-circle-orange">
          <circle cx="45" cy="40" r="30" />
        </g>
        <g className="constellation-line lbx-circle-green">
          <circle cx="90" cy="40" r="30" />
        </g>
        <g className="constellation-line lbx-circle-blue">
          <circle cx="135" cy="40" r="30" />
        </g>
        <g className="constellation-stars">
          <circle cx="15" cy="40" r="1.5" />
          <circle cx="90" cy="10" r="1.5" />
          <circle cx="165" cy="40" r="1.5" />
          <circle cx="90" cy="70" r="1.5" />
        </g>
      </svg>
      </div>
    </>
  );
}
