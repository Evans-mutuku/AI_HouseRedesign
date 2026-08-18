// A representative direction used as the landing example. This is data — real
// product output (palette + lines), no photography. It sells the result by
// showing the actual quality of what the studio returns.
export const SAMPLE = {
  roomType: 'Living room',
  style: 'Warm Minimal',
  concept:
    'Let the afternoon light do the decorating. We strip the room back to a warm, chalk-white envelope, keep the oak that already grounds it, and add one low, generous sofa in oat linen so the eye finally has somewhere to rest.',
  palette: [
    { name: 'Chalk', hex: '#EDE7DA', role: 'Walls — a softer, warmer white' },
    { name: 'Oat Linen', hex: '#D8C9AE', role: 'Sofa, drapery, soft goods' },
    { name: 'Raw Oak', hex: '#A9855C', role: 'Existing floor and credenza' },
    { name: 'Ironstone', hex: '#4B4E50', role: 'Anchor — frames, hardware' },
    { name: 'Clay', hex: '#B5502D', role: 'Single accent — one vessel' },
  ],
  lines: [
    { action: 'Keep', text: 'The oak credenza — repositioned to the long wall.' },
    { action: 'Add', text: 'A low oat-linen sofa, no higher than the sill.' },
    { action: 'Light', text: 'Swap the cool overhead for a warm 2700K wash.' },
  ],
};
