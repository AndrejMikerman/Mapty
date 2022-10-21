'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const containerMap = document.getElementById('map');
const btnDeleteAll = document.querySelector('.btn__delete--all');
const containerSortDropdown = document.querySelector('.dropdown__content');
const containerAlert = document.querySelector('.alert');
const overlay = document.querySelector('.overlay');

class Workout {
  date = new Date();
  id = Date.now(); // Usually a library is ised to create an id
  clicks = 0;
  constructor(distance, duration, coords) {
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.coords = coords; // [lat,lng]
  }
  click() {
    this.clicks++;
  }
  getEmoji(type) {
    if (type === 'running') return '🏃';
    if (type === 'cycling') return '🚴';

    return type;
  }
  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description =
      `${this.getEmoji(this.type)} ` +
      this.type[0].toUpperCase() +
      this.type.slice(1) +
      ` on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }
  setDate(date) {
    this.date = date;
    this._setDescription();
  }
  get timestamp() {
    return this.date.valueOf();
  }
  importData(importObj) {
    for (const [property, value] of Object.entries(importObj)) {
      this[property] = value;
    }
    this._setDescription();
  }
}
class Running extends Workout {
  type = 'running';
  constructor(distance, duration, coords, cadance) {
    super(distance, duration, coords);
    this.cadance = cadance;
    this._setDescription();
  }
  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(distance, duration, coords, elevationGain) {
    super(distance, duration, coords);
    this.elevationGain = elevationGain;
    this._setDescription();
  }
  calcSpeed() {
    //km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}
////////////////////////////////////////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #editMode = { state: false, workout: undefined };
  constructor() {
    //Get user's position
    this._getPosistion();

    //get data from local Storage
    this._getLocalStorage();
    //Attach event handlers
    btnDeleteAll.addEventListener('click', this._alertDeleteAll);
    inputType.addEventListener('change', this._toggleElevationField);
    form.addEventListener('submit', this._newWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._moveToMarker.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    containerSortDropdown.addEventListener('click', this._sortBy.bind(this));
    containerAlert.addEventListener('click', this.reset);
  }
  _getPosistion() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }
  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }
  _moveToMarker(e) {
    if (!e.target.closest('.workout') || e.target.classList.contains('btn'))
      return;

    const idEl = +e.target.closest('.workout').dataset.id;
    const workoutPerId = this.#workouts.find(wo => wo.id === idEl);
    this.#map.setView(workoutPerId.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
    //Using the public interface
    workoutPerId.click();
  }
  _showForm(mapE) {
    if (form.classList.contains('hidden')) {
      form.classList.remove('hidden');
      inputDistance.focus();
      this.#mapEvent = mapE;
    }
  }
  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    inputType.form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
    containerWorkouts.insertAdjacentElement('afterbegin', form);
  }
  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();
    if (!form.classList.contains('hidden')) {
      //Helper functions
      const validInputs = (...inputs) =>
        inputs.every(inp => Number.isFinite(inp));
      const allPositive = (...inputs) => inputs.every(inp => inp > 0);

      //Get data from form
      const type = inputType.value;
      const distance = +inputDistance.value;
      const duration = +inputDuration.value;
      let { lat, lng } = this.#mapEvent?.latlng || { lat: 42, lng: 42 };
      let workout;
      //editing mode
      if (this.#editMode.state) {
        [lat, lng] = this.#editMode.workout.coords;
      }
      // if workout running,create running object
      if (type === 'running') {
        const cadance = +inputCadence.value;
        //Check if data is valid
        if (
          !validInputs(distance, duration, cadance) ||
          !allPositive(distance, duration, cadance)
        )
          return alert('Inputs have to be positive numbers!');

        workout = new Running(distance, duration, [lat, lng], cadance);
      }

      // if workout cycling,create cycling object
      if (type === 'cycling') {
        const elevation = +inputElevation.value;
        if (
          !validInputs(distance, duration, elevation) ||
          !allPositive(distance, duration)
        )
          return alert('Inputs have to be positive numbers!');

        workout = new Cycling(distance, duration, [lat, lng], elevation);
      }
      //Delete old workout if in edit mode
      if (this.#editMode.state) {
        workout.id = this.#editMode.workout.id;
        workout.setDate(this.#editMode.workout.date);
        //replace old workout in the array with the edited one
        const woIndex = this.#workouts.findIndex(
          wo => wo.id === this.#editMode.workout.id
        );
        this.#workouts.splice(woIndex, 1);

        //remove old marker
        this._deleteMarkerById(this.#editMode.workout.id);
        //reset Editmode
        this.#editMode.state = false;
        this.#editMode.workout = undefined;
      }

      //Add new object to workout array
      this.#workouts.push(workout);
      // Render workout on map as marker
      this._renderWorkoutMarker(workout);

      // Render workout on list
      this._renderWorkout(workout);
      // Hide form + clear input fields
      this._hideForm();

      //Set local Storage to all workouts
      this._setLocalStorage();
    }
  }
  _editWorkout(e) {
    if (!e.target.classList.contains('btn__edit')) return;

    const domEl = e.target.closest('.workout');
    const woID = +domEl.dataset.id;
    const wo = this.#workouts.find(wo => wo.id === woID);
    //delete list item and render form at the same place
    // containerWorkouts.removeChild(domEl);
    domEl.replaceWith(form);
    // open label

    //change form variables
    if (inputType.value !== wo.type) this._toggleElevationField();
    inputType.value = wo.type;
    inputDistance.value = wo.distance;
    inputDuration.value = wo.duration;
    if (wo.type === 'running') inputCadence.value = wo.cadance;
    if (wo.type === 'cycling') inputElevation.value = wo.elevationGain;
    this._showForm();
    //open form in the place of the workout

    //toggle edit mode
    this.#editMode.state = true;
    this.#editMode.workout = wo;
  }
  _deleteWorkout(e) {
    if (!e.target.classList.contains('btn__delete')) return;
    const domEl = e.target.closest('.workout');
    const woID = +domEl.dataset.id;
    const woIndex = this.#workouts.findIndex(wo => wo.id === woID);

    //delete marker
    this._deleteMarkerById(woID);
    //delete list item
    containerWorkouts.removeChild(domEl);
    //delete from workouts arr
    this.#workouts.splice(woIndex, 1);
    //update local
    this._setLocalStorage();
  }
  _deleteMarkerById(id) {
    this.#map.eachLayer(function (layer) {
      //every layer has an option.
      if (layer.options.alt === id) layer.remove();
    });
  }
  _renderWorkoutMarker(workout) {
    /////////////////////////////POPUP/////////////////////////

    const popUp = L.popup({
      minWidth: 300,
      maxWidth: 300,
      interactive: true,
      autoClose: false,
      closeOnClick: false,
      className: `${workout.type}-popup`,
    });

    L.marker(workout.coords, { riseOnHover: true, alt: workout.id })
      .addTo(this.#map)
      .bindPopup(popUp)
      .setPopupContent(workout.description)
      .openPopup();
    ////////////////////////////////////////////////////////////////
  }
  _renderWorkout(workout) {
    // prettier-ignore
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <div class="container__btn">
        <a href="#" class = "btn__${workout.type} btn__delete">delete</a>
        <a href="#" class = "btn__${workout.type} btn__edit">edit</a>
      </div>
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon">${workout.getEmoji(workout.type)}</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>`
    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.calcPace().toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadance}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;
    }
    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.calcSpeed().toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>`;
    }
    form.insertAdjacentHTML('afterend', html);
  }
  _setLocalStorage() {
    //very simple API do not use for large amounts of data
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    const integrateWO = function (wo, woEl) {
      wo.importData(woEl);
      this.#workouts.push(wo);
      this._renderWorkout(wo);
    }.bind(this);

    data.forEach(
      function (workoutEl) {
        workoutEl.date = new Date(workoutEl.date);
        const type = workoutEl.type;
        if (type === 'running') {
          const workoutRunning = new Running();
          integrateWO(workoutRunning, workoutEl);
        }
        if (type === 'cycling') {
          const workoutCycling = new Cycling();
          integrateWO(workoutCycling, workoutEl);
        }
      }.bind(this)
    );
  }

  reset(e) {
    //add a questioning
    console.log(e.target);
    if (e.target.classList.contains('btn__yes')) {
      localStorage.removeItem('workouts');
      location.reload();
    }
    if (e.target.classList.contains('btn__no')) {
      containerAlert.classList.add('hidden');
      overlay.classList.add('hidden');
    }
  }
  _alertDeleteAll() {
    containerAlert.classList.remove('hidden');
    overlay.classList.remove('hidden');
  }
  _blinkForm() {
    if (!form.classList.contains('attention')) {
      form.classList.add('attention');
      setTimeout(() => form.classList.remove('attention'), 2000);
    }
  }
  _sortBy(e) {
    //cannot sort while editing or creating new workout.
    //in other words the form must be hidden and on top
    if (this.#editMode.state) {
      //blink the form
      this._blinkForm();
      return;
    }

    if (!e.target.classList.contains('sort__option')) return;

    const compare = function (a, b, condition, order) {
      const aWo = this.#workouts.find(el => el.id === +a.dataset.id);
      const bWo = this.#workouts.find(el => el.id === +b.dataset.id);
      // > 0 switch
      // < 0 stay
      // a - b ascending
      // b - a descending
      if (order === 'ascending') return aWo[condition] - bWo[condition];
      if (order === 'descending') return bWo[condition] - aWo[condition];
    }.bind(this);

    //create an array with all the elements
    //first element is always the form
    const [_, ...workoutElements] = Array.from(containerWorkouts.children);
    const [condition, order] = e.target.id.split('_');

    //sort them
    workoutElements.sort((a, b) => compare(a, b, condition, order));

    //need to clear the workout list container? No
    //insert into the html file
    workoutElements.forEach(el =>
      containerWorkouts.insertAdjacentElement('beforeend', el)
    );
  }
}
const app = new App();
