export function dragHandle(row, group, id, onDrop) {
  row.dataset.dragGroup = group;
  row.dataset.dragId = id;
  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '⠿';
  handle.title = 'Sıralamak için sürükle';
  handle.setAttribute('aria-hidden', 'true');
  let pointer = null;
  let target = null;

  function candidate(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    return element?.closest('[data-drag-group="' + group + '"]');
  }

  function highlight(next) {
    target?.classList.remove('drop-target');
    target = next;
    target?.classList.add('drop-target');
  }

  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer !== null) return;
    pointer = event.pointerId;
    handle.setPointerCapture(pointer);
    row.classList.add('dragging');
    event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (pointer === event.pointerId) highlight(candidate(event));
  });
  handle.addEventListener('pointerup', event => {
    if (pointer !== event.pointerId) return;
    const destination = candidate(event)?.dataset.dragId;
    if (destination && destination !== id) onDrop(id, destination);
  });
  handle.addEventListener('lostpointercapture', () => {
    pointer = null;
    highlight(null);
    row.classList.remove('dragging');
  });
  return handle;
}
