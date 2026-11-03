// Главный модуль игры. Он связывает все остальные части:
// apartment.js строит квартиру, cat.js управляет котом,
// items.js отвечает за разрушения, audio.js — за звуки.
import * as THREE from 'three';
import { createApartment } from './apartment.js';
import { Cat } from './cat.js';
import { DestructibleSystem } from './items.js';
import { GameAudio } from './audio.js';
import './style.css';

// Короткая функция для поиска HTML-элемента по CSS-селектору.
// Например, $('#score') находит элемент с id="score".
const $ = (selector) => document.querySelector(selector);
const canvas = $('#scene');

// WebGLRenderer рисует 3D-сцену внутри <canvas>.
// antialias сглаживает края объектов, а pixelRatio ограничен ради производительности.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

// Scene — контейнер для всех 3D-объектов, а PerspectiveCamera — глаз игрока.
// Туман скрывает далёкие объекты и помогает смягчить границы игрового мира.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x89988a);
scene.fog = new THREE.Fog(0x89988a, 23, 42);
const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, .1, 100);

// Общий свет освещает все объекты. Направленный свет имитирует солнце
// и создаёт тени. Второй, холодный свет смягчает тёмные участки комнаты.
const hemisphere = new THREE.HemisphereLight(0xfff4db, 0x57614e, 2.25);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xffe5be, 4.1);
sun.position.set(-6, 13, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -13;
sun.shadow.camera.right = 13;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
sun.shadow.camera.near = .5;
sun.shadow.camera.far = 35;
sun.shadow.bias = -.00025;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xb8d5dd, 1.1);
fill.position.set(8, 7, -5);
scene.add(fill);

// Большая плоскость под квартирой нужна, чтобы не было видно пустоты.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x697765, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.32;
ground.receiveShadow = true;
scene.add(ground);

const audio = new GameAudio();
const cat = new Cat(scene);

// Переменные текущего раунда. state может принимать значения:
// 'start' — стартовый экран, 'playing' — игра, 'paused' — пауза, 'ended' — результат.
let score = 0;
let destroyed = 0;
let timeLeft = 60;
let state = 'start';
let combo = 0;
let bestCombo = 0;
let comboTime = 0;
let lastTenWarning = false;
let shake = 0;

// При регистрации каждого предмета квартира передаёт его системе разрушений.
// handleBreak и handleHit — функции обратного вызова: физика сообщает им о событиях.
const destructibles = new DestructibleSystem(scene, handleBreak, handleHit);
createApartment(scene, (mesh, config) => destructibles.register(mesh, config));
const totalItems = destructibles.items.length;
const totalValue = destructibles.items.reduce((sum, item) => sum + item.value, 0);

// В input хранится не само событие клавиши, а её текущее состояние: нажата или нет.
// Это позволяет двигать котом непрерывно, пока игрок удерживает кнопку.
const input = { up: false, down: false, left: false, right: false, sprint: false, jump: false };
let cameraYaw = .48;
let cameraDistance = 11.8;
let cameraHeight = 9.2;
const cameraTarget = new THREE.Vector3(0, .6, 2.5);
camera.position.set(6, 9, 13);
camera.lookAt(cameraTarget);
const clock = new THREE.Clock();

// Переводит число в привычную денежную строку: 125000 → «125 000 ₽».
function formatMoney(value) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function handleHit(item, destroyedByHit) {
  if (destroyedByHit) audio.crash(item.mass > 4);
  else audio.hit();
}

// Вызывается из DestructibleSystem, когда здоровье предмета закончилось.
function handleBreak(item, position) {
  if (state !== 'playing') return;

  // Если с прошлого разрушения прошло меньше 3,2 секунды, серия продолжается.
  // Каждые два предмета увеличивают множитель на 0,5; максимум — ×4.
  combo = comboTime > 0 ? combo + 1 : 1;
  comboTime = 3.2;
  bestCombo = Math.max(bestCombo, combo);
  const multiplier = Math.min(4, 1 + Math.floor((combo - 1) / 2) * .5);
  const earned = Math.round(item.value * multiplier);
  score += earned;
  destroyed++;
  shake = Math.min(.5, shake + .1 + item.mass * .015);
  updateScore(earned);
  updateChaos();
  showFloater(position, earned, item.name, multiplier);
  if (combo >= 2) {
    $('#combo').classList.remove('hidden');
    $('#combo-value').textContent = `×${multiplier}`;
  }
  if (destroyed === 10) showToast('10 предметов! Кот входит во вкус.');
  if (destroyed === totalItems) showToast('Квартира полностью уничтожена. Идеально.');
}

function updateScore(earned) {
  $('#score').textContent = formatMoney(score);
  if (earned) {
    const tick = $('#score-tick');
    tick.textContent = `+${formatMoney(earned)}`;
    tick.classList.remove('pop');
    // Чтение offsetWidth заставляет браузер применить изменения и перезапустить CSS-анимацию.
    void tick.offsetWidth;
    tick.classList.add('pop');
  }
}

function updateChaos() {
  $('#destroyed-count').textContent = `${destroyed} / ${totalItems}`;
  $('#chaos-progress').style.width = `${Math.min(100, score / totalValue * 100)}%`;
  // Оставляем последний уровень, порог которого уже достигнут текущим счётом.
  const levels = [[0, 'Домашний'], [50000, 'Шалость'], [150000, 'Переполох'], [350000, 'Котопад'], [700000, 'Легенда']];
  $('#chaos-label').textContent = levels.filter(([threshold]) => score >= threshold).at(-1)[1];
}

// Показывает всплывающую сумму прямо над сломанным предметом.
function showFloater(position, earned, name, multiplier) {
  // project(camera) переводит 3D-координаты в нормализованные экранные координаты.
  // Затем диапазон [-1, 1] преобразуется в пиксели окна.
  const projected = position.clone().project(camera);
  const element = document.createElement('div');
  element.className = 'floater';
  element.style.left = `${(projected.x * .5 + .5) * window.innerWidth}px`;
  element.style.top = `${(-projected.y * .5 + .5) * window.innerHeight}px`;
  element.innerHTML = `+${formatMoney(earned)}<small>${name}${multiplier > 1 ? ` · ×${multiplier}` : ''}</small>`;
  $('#floaters').append(element);
  setTimeout(() => element.remove(), 1350);
}

let toastTimeout;
function showToast(message) {
  const toast = $('#toast');
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.style.animation = 'none';
  void toast.offsetWidth;
  toast.style.animation = '';
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2250);
}

// Сброс кнопок нужен при паузе: иначе кот мог бы продолжить движение
// после возвращения в игру, даже если игрок уже отпустил клавишу.
function clearInput() {
  input.up = input.down = input.left = input.right = input.sprint = input.jump = false;
}

// Полный сброс раунда: восстанавливаем предметы, кота, счётчики и интерфейс.
function startGame() {
  audio.init();
  audio.start();
  destructibles.reset();
  cat.reset();
  score = 0;
  destroyed = 0;
  timeLeft = 60;
  combo = 0;
  bestCombo = 0;
  comboTime = 0;
  lastTenWarning = false;
  state = 'playing';
  clearInput();
  updateScore();
  updateChaos();
  updateTimer();
  $('#start-overlay').classList.add('hidden');
  $('#end-overlay').classList.add('hidden');
  $('#pause-overlay').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  $('#controls-hint').classList.remove('hidden');
  $('#combo').classList.add('hidden');
  $('#target-hint').classList.add('hidden');
  $('#floaters').replaceChildren();
  cameraYaw = .48;
  cameraDistance = 11.8;
  cameraHeight = 9.2;
  showToast('Хозяин ушёл. У тебя 60 секунд!');
}

// Во время паузы главный цикл продолжает рисовать сцену, но таймер и физика не идут.
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  clearInput();
  $('#pause-overlay').classList.remove('hidden');
  $('#target-hint').classList.add('hidden');
}

function resumeGame() {
  if (state !== 'paused') return;
  audio.init();
  state = 'playing';
  // Считываем накопившееся время, чтобы длинная пауза не попала в следующий dt.
  clock.getDelta();
  $('#pause-overlay').classList.add('hidden');
}

function finishGame() {
  if (state !== 'playing') return;
  state = 'ended';
  clearInput();
  audio.end();
  $('#target-hint').classList.add('hidden');
  $('#combo').classList.add('hidden');
  $('#controls-hint').classList.add('hidden');
  $('#final-score').textContent = formatMoney(score);
  $('#final-destroyed').textContent = destroyed;
  $('#final-combo').textContent = `×${Math.min(4, 1 + Math.floor((Math.max(1, bestCombo) - 1) / 2) * .5)}`;

  // Условия расположены по возрастанию: более высокий результат заменяет предыдущий титул.
  let rank = 'Котёнок';
  let title = 'Хозяин почти не расстроится';
  let subtitle = 'Но пару вопросов всё же задаст.';
  if (score >= 100000) { rank = 'Шалун'; title = 'Вот это разнос!'; subtitle = 'Квартира запомнит эту минуту.'; }
  if (score >= 350000) { rank = 'Гроза квартир'; title = 'Вот это котопад!'; subtitle = 'Страховая уже нервно пьёт валерьянку.'; }
  if (score >= 700000) { rank = 'Легенда'; title = 'Абсолютный хаос!'; subtitle = 'Тебя занесут в кошачью книгу рекордов.'; }
  if (score >= 1200000) { rank = 'Котастрофа'; title = 'Ничего не осталось!'; subtitle = 'Даже стены слегка нервничают.'; }
  $('#final-rank').textContent = rank;
  $('#result-title').textContent = title;
  $('#result-subtitle').textContent = subtitle;
  $('#end-overlay').classList.remove('hidden');
}

function updateTimer() {
  // Math.ceil не показывает ноль раньше времени, а padStart добавляет ведущий ноль.
  const seconds = Math.max(0, Math.ceil(timeLeft));
  $('#timer').textContent = `00:${String(seconds).padStart(2, '0')}`;
  $('#timer-card').classList.toggle('danger', seconds <= 10);
}

function performAttack() {
  if (state !== 'playing') return;
  // Сначала проверяем задержку атаки у кота, затем ищем предмет в системе разрушений.
  if (cat.attack()) {
    audio.swipe();
    destructibles.attack(cat);
  }
}

// Связываем HTML-кнопки с функциями игры.
$('#start-button').addEventListener('click', startGame);
$('#restart-button').addEventListener('click', startGame);
$('#pause-restart-button').addEventListener('click', startGame);
$('#resume-button').addEventListener('click', resumeGame);
$('#pause-button').addEventListener('click', () => state === 'paused' ? resumeGame() : pauseGame());
$('#camera-button').addEventListener('click', () => {
  cameraYaw = .48;
  cameraDistance = 11.8;
  cameraHeight = 9.2;
});
$('#sound-button').addEventListener('click', () => {
  audio.init();
  audio.setMuted(!audio.muted);
  $('#sound-button').style.opacity = audio.muted ? '.45' : '1';
  $('#sound-button').title = audio.muted ? 'Включить звук' : 'Выключить звук';
  $('#sound-button').setAttribute('aria-label', $('#sound-button').title);
});
$('.brand').addEventListener('click', (event) => event.preventDefault());

// event.code обозначает физическую клавишу, поэтому WASD работает при любой раскладке.
const keyMap = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};
window.addEventListener('keydown', (event) => {
  // Отключаем прокрутку страницы стрелками и пробелом.
  if (keyMap[event.code] || event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'ArrowDown') event.preventDefault();
  if (keyMap[event.code]) input[keyMap[event.code]] = true;
  if (event.code === 'Space' && state === 'playing' && !event.repeat) {
    if (cat.grounded) audio.jump();
    input.jump = true;
  }
  if (event.code === 'KeyF' && !event.repeat) performAttack();
  if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (event.code === 'Enter' && !event.repeat && (state === 'start' || state === 'ended')) startGame();
});
window.addEventListener('keyup', (event) => {
  if (keyMap[event.code]) input[keyMap[event.code]] = false;
});
// Если игрок переключил окно, ставим паузу и сбрасываем зажатые кнопки.
window.addEventListener('blur', () => {
  clearInput();
  if (state === 'playing') pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
});

// Короткий клик по сцене — удар, а перетаскивание мышью — вращение камеры.
// moved суммирует путь указателя, чтобы отличить эти два действия.
let drag = null;
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 && event.button !== 2) return;
  drag = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: 0, button: event.button };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const dx = event.clientX - drag.lastX;
  const dy = event.clientY - drag.lastY;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  cameraYaw -= dx * .005;
  cameraHeight = THREE.MathUtils.clamp(cameraHeight + dy * .025, 5.5, 13);
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
});
canvas.addEventListener('pointerup', (event) => {
  if (drag && drag.moved < 6 && drag.button === 0) performAttack();
  drag = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * .008, 7, 16);
}, { passive: false });

// При изменении окна обновляем и пропорции камеры, и размер холста.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
});

function updateCamera(dt) {
  // lerp плавно приближает камеру к коту вместо резкой привязки к его координатам.
  const desiredTarget = new THREE.Vector3(cat.group.position.x, .65 + cat.group.position.y * .3, cat.group.position.z);
  cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 4.5));
  // sin и cos задают положение камеры на окружности вокруг кота.
  const desired = new THREE.Vector3(
    cameraTarget.x + Math.sin(cameraYaw) * cameraDistance,
    cameraTarget.y + cameraHeight,
    cameraTarget.z + Math.cos(cameraYaw) * cameraDistance,
  );
  camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
  // Небольшое случайное смещение создаёт тряску после разрушения и быстро затухает.
  if (shake > .002) {
    camera.position.x += (Math.random() - .5) * shake;
    camera.position.y += (Math.random() - .5) * shake;
    shake *= Math.pow(.025, dt);
  }
  camera.lookAt(cameraTarget);
}

// Главный игровой цикл: браузер вызывает animate() примерно 60 раз в секунду.
// Порядок важен: сначала движение и физика, потом время/интерфейс, затем отрисовка.
function animate() {
  requestAnimationFrame(animate);
  // dt ограничен, чтобы после зависания вкладки объекты не перелетели через всю комнату.
  const dt = Math.min(clock.getDelta(), .05);
  const active = state === 'playing';
  const catState = cat.update(dt, input, cameraYaw, active || state === 'start');
  if (active) {
    destructibles.update(dt, cat, catState, true);
    timeLeft -= dt;
    comboTime = Math.max(0, comboTime - dt);
    if (comboTime === 0 && combo > 0) {
      combo = 0;
      $('#combo').classList.add('hidden');
    } else if (combo > 1) {
      $('#combo i').style.transform = `scaleX(${comboTime / 3.2})`;
    }
    updateTimer();
    if (timeLeft <= 10 && !lastTenWarning) {
      lastTenWarning = true;
      showToast('10 секунд! Не останавливайся!');
    }
    if (timeLeft <= 0) finishGame();
    const target = destructibles.getTarget(cat);
    if (target) {
      $('#target-name').textContent = target.name;
      $('#target-value').textContent = formatMoney(target.value);
      $('#target-hint').classList.remove('hidden');
    } else $('#target-hint').classList.add('hidden');
  } else if (state === 'start') {
    // На стартовом экране сцена остаётся живой, но столкновения и очки отключены.
    destructibles.update(dt, cat, catState, false);
  } else if (state === 'ended') {
    destructibles.update(dt, cat, catState, false);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

updateChaos();
animate();
