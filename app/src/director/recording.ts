export function recordingVisibility(recording:boolean,hud=true) {
 return {hud:!recording||hud,director:!recording,story:!recording,network:!recording};
}
