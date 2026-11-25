import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import { Composition } from 'remotion';

import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from './theme';
import { Trailer } from './Trailer';

export const Root = () => (
  <Composition
    id="YardTrailer"
    component={Trailer}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
