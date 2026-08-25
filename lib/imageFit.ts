// "Contain" fit math for placing the source image/video inside the WebGL view.
// The orthographic camera spans height 2 (-1..1) and width 2*containerAspect,
// and the plane geometry is 2x2, so these scale factors letterbox the source to
// fit without cropping. Pure so the fit is locked under tests.

export interface FitScale {
  scaleX: number;
  scaleY: number;
}

export function containScale(imageAspect: number, containerAspect: number): FitScale {
  if (imageAspect > containerAspect) {
    // Wider than the container: fit to width, letterbox top/bottom.
    return { scaleX: containerAspect, scaleY: containerAspect / imageAspect };
  }
  // Taller than (or equal to) the container: fit to height, letterbox sides.
  return { scaleX: imageAspect, scaleY: 1 };
}
