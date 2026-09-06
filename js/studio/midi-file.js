// Standard MIDI File, format 0, 480 PPQN, fixed 500000 µs/quarter tempo.
// Recorded wall-clock durations are preserved; tempo is not an inferred BPM.
function variableLength(value) {
    const bytes = [value & 127];
    while ((value >>>= 7)) bytes.unshift((value & 127) | 128);
    return bytes;
}

export function encodeMidi(recording) {
    const track = [0, 0xff, 0x51, 3, 7, 0xa1, 0x20];
    let last = 0;
    for (const event of recording.events) {
        const tick = Math.max(last, Math.round(event.at * 0.96));
        track.push(...variableLength(tick - last), ...event.data);
        last = tick;
    }
    const end = Math.max(last, Math.round(recording.durationMs * 0.96));
    // Interrupted drafts may end with keys held down.
    for (let channel = 0; channel < 16; channel++) {
        track.push(...variableLength(channel === 0 ? end - last : 0), 0xb0 | channel, 120, 0);
    }
    track.push(0, 0xff, 0x2f, 0);
    const bytes = new Uint8Array(22 + track.length);
    bytes.set([77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 1, 224, 77, 84, 114, 107]);
    new DataView(bytes.buffer).setUint32(18, track.length);
    bytes.set(track, 22);
    return bytes;
}

export function downloadMidi(recording) {
    const url = URL.createObjectURL(new Blob([encodeMidi(recording)], { type: 'audio/midi' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80) || 'kayit'}.mid`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
