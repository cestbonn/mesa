/* runcontrol.js
 Users can reset() the model, advance it by one step(), or start() it. reset() and
 step() send a message to the server, which then sends back the appropriate data.
 start() just calls the step() method at fixed intervals.

 The model parameters are controlled via the ModelController object.
*/

/*
 * Variable definitions
 */
const controller = new ModelController();
const vizElements = [];
const startModelButton = document.getElementById("play-pause");
const stepModelButton = document.getElementById("step");
const resetModelButton = document.getElementById("reset");
const stepDisplay = document.getElementById("currentStep");
const saveButton = document.getElementById("save-button");
// startModelButton.firstElementChild.innerText = "Stop";

// const chartElements = document.getElementById("elements");

/**
 * A ModelController that defines the model state.
 * @param  {number} tick=0 - Initial step of the model
 * @param  {number} fps=3 - Run the model with this number of frames per second
 * @param  {boolean} running=false - Initialize the model in a running state?
 * @param  {boolean} finished=false - Initialize the model in a finished state?
 */
function ModelController(tick = 0, fps = 3, running = false, finished = false) {
  this.tick = tick;
  this.fps = fps;
  this.running = running;
  this.finished = finished;

  this.save = function save() {
    var filename = document.getElementById('save-input').value;

    document.getElementById('save-input').value='';
    const option = document.createElement("option");
    option.value = filename+'.csv';
    option.text = filename+'.csv';

    const compared_data_dropdown = document.getElementById('compared_data_id');
    var flg = true;
    for (let i = 0; i<compared_data_dropdown.options.length; i++){
        if (compared_data_dropdown.options[i].value === option.value) {
            flg = false;
            break;
        }
    }
    if (flg === true){
        compared_data_dropdown.appendChild(option);
    }


    send({ type: "save", name: filename})
  }
  /** Start the model and keep it running until stopped */
  this.start = function start() {
    this.running = true;
    this.step();
    startModelButton.firstElementChild.innerText = "Stop";
    window.scrollTo(0, 420);
  };

  /** Stop the model */
  this.stop = function stop() {
    this.running = false;
    startModelButton.firstElementChild.innerText = "Start";
  };

  /**
   * Step the model one step ahead.
   *
   * If the model is in a running state this function will be called repeatedly
   * after the visualization elements are rendered. */
  this.step = function step() {
    this.tick += 1;
    stepDisplay.innerText = this.tick;
    send({ type: "get_step", step: this.tick });
  };

  /** Reset the model and visualization state but keep its running state */
  this.reset = function reset() {
    this.tick = 0;
    stepDisplay.innerText = this.tick;
    // Reset all the visualizations
    vizElements.forEach((element) => element.reset());
    if (this.finished) {
      this.finished = false;
      startModelButton.firstElementChild.innerText = "Start";
    }
    clearTimeout(this.timeout);
    send({ type: "reset" });
  };

  /** Stops the model and put it into a finished state */
  this.done = function done() {
    this.stop();
    this.finished = true;
    startModelButton.firstElementChild.innerText = "Done";
  };

  /**
   * Render visualisation elements with new data.
   * @param {any[]} data Model state data passed to the visualization elements
   */
  this.render = function render(data) {
    vizElements.forEach((element, index) => element.render(data[index]));
    if (this.running) {
      this.timeout = setTimeout(() => this.step(), 1000 / this.fps);
    }
  };

  /**
   * Update the frames per second
   * @param {number} val - The new value of frames per second
   */
  this.updateFPS = function (val) {
    this.fps = Number(val);
  };
}

/*
 * Set up the the FPS control
 */
const fpsControl = new Slider("#fps", {
  max: 20,
  min: 0,
  value: controller.fps,
  ticks: [0, 20],
  ticks_labels: [0, 20],
  ticks_position: [0, 100],
});
fpsControl.on("change", () => controller.updateFPS(fpsControl.getValue()));

/*
 * Button logic for start, stop and reset buttons
 */
startModelButton.onclick = () => {
  if (controller.running) {
    controller.stop();
  } else if (!controller.finished) {
    controller.start();
  }
};
stepModelButton.onclick = () => {
  if (!controller.running & !controller.finished) {
    controller.step();
  }
};
resetModelButton.onclick = () => controller.reset();
saveButton.onclick = () => controller.save();
/*
 * Websocket opening and message handling
 */

/** Open the websocket connection; support TLS-specific URLs when appropriate */
const ws = new WebSocket(
  (window.location.protocol === "https:" ? "wss://" : "ws://") +
    location.host +
    "/ws"
);

/**
 * Parse and handle an incoming message on the WebSocket connection.
 * @param {string} message - the message received from the WebSocket
 */
ws.onmessage = function (message) {
  const msg = JSON.parse(message.data);
  switch (msg["type"]) {
    case "viz_state":
      // Update visualization state
      controller.render(msg["data"]);
      break;
    case "end":
      // We have reached the end of the model
      controller.done();
      break;
    case "model_params":
      // Create GUI elements for each model parameter and reset everything
      initGUI(msg["params"]);
      controller.reset();
      break;
    default:
      // There shouldn't be any other message
      console.log("Unexpected message.");
      console.log(msg);
  }
};

/**
 * Turn an object into a string to send to the server, and send it.
 * @param {string} message - The message to send to the Python server
 */
const send = function (message) {
  const msg = JSON.stringify(message);
  ws.send(msg);
};

/*
 * GUI initialization (for input parameters)
 */

/**
 * Create the GUI with user-settable parameters
 * @param {object} model_params - Create the GUI from these model parameters
 */
const initGUI = function (model_params) {
  const sidebar = document.getElementById("sidebar");

  const onSubmitCallback = function (param_name, value) {
    send({ type: "submit_params", param: param_name, value: value });
  };

  const addBooleanInput = function (param, obj) {
    const domID = param + "_id";
    const _switch = document.createElement("div");
    _switch.className = "form-check form-switch";

    const label = `
      <label class="form-check-label badge bg-primary" for="${domID}">
        ${obj.name}
      </label>
    `;
    _switch.innerHTML += label;

    const input = document.createElement("input");
    Object.assign(input, {
      className: "form-check-input model-parameter",
      type: "checkbox",
      id: domID,
      checked: obj.value,
    });
    input.setAttribute("role", "switch");
    input.addEventListener("change", (event) =>
      onSubmitCallback(param, event.currentTarget.checked)
    );
    _switch.appendChild(input);

    sidebar.appendChild(_switch);
  };

  const addNumberInput = function (param, obj) {
    const domID = param + "_id";
    const div = document.createElement("div");
    div.innerHTML = `
      <p>
        <label for='${domID}' class='badge bg-primary'>
          ${obj.name}
        </label>
      </p>
      <input class='model-parameter' id='${domID}' type='number'/>
    `;
    sidebar.appendChild(div);
    const numberInput = document.getElementById(domID);
    numberInput.value = obj.value;
    numberInput.onchange = () => {
      onSubmitCallback(param, Number(numberInput.value));
    };
  };

  const addSliderInput = function (param, obj) {
    const domID = param + "_id";
    const tooltipID = domID + "_tooltip";
    let tooltip = "";
    // Enable tooltip label
    if (obj.description !== null) {
      tooltip = `title='${obj.description}'`;
    }

    const div = document.createElement("div");
    div.innerHTML = `
      <p>
        <span id='${tooltipID}' ${tooltip} data-bs-toggle='tooltip' data-bs-placement='top' class='badge bg-primary'>
          ${obj.name}
        </span>
      </p>
      <input id='${domID}' type='text' />
    `;
    sidebar.appendChild(div);

    // Setup slider
    const sliderInput = new Slider("#" + domID, {
      min: obj.min_value,
      max: obj.max_value,
      value: obj.value,
      step: obj.step,
      ticks: [obj.min_value, obj.max_value],
      ticks_labels: [obj.min_value, obj.max_value],
      ticks_positions: [0, 100],
    });
    sliderInput.on("change", () => {
      onSubmitCallback(param, Number(sliderInput.getValue()));
    });
  };

  const addChoiceInput = function (param, obj) {
    const domID = param + "_id";
    const template = [
      `<p></p>
        <label for='${domID}' class='badge bg-primary' style="width: 200px">
        ${obj.name}
        </label>
      `,
      `<select
        id='${domID}'
        class='form-select'
        style='width:200px'
        aria-label='select input'>`,
    ];
    for (const idx in obj.choices) {
      const choice = obj.choices[idx];
      const selected = choice === obj.value ? "selected" : "";
      // template.push(`<option ${selected} value=${idx}>${choice}</option>`);
      template.push(`<option ${selected} value=${choice}>${choice}</option>`);
    }

    // Close the select options
    template.push("</select>");

    // Finally render the dropdown and activate choice listeners
    const div = document.createElement("div");
    div.innerHTML = template.join("");
    sidebar.appendChild(div);

    const select = document.getElementById(domID);
    // select.onchange = () => onSubmitCallback(param, obj.choices[select.value]);
    select.onchange = () => onSubmitCallback(param, select.value);
  };

  const addTextBox = function (param, obj) {
    const well = document.createElement("div");
    well.className = "well";
    well.innerHTML = obj.value;
    sidebar.appendChild(well);
  };

  const addTextInput = function (text_id, button_id, default_text, button_text) {
    var containerDiv = document.createElement('div');

    var paragraphElement = document.createElement('p');

    var valueLabel = document.createElement('label');
    valueLabel.className = 'badge bg-primary';
    valueLabel.textContent = 'Value';

    var inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.id = text_id;
    inputElement.style.display = 'inline-block';
    inputElement.style.marginRight = '5px';
    inputElement.style.height = '40px';
    inputElement.style.padding = '6px 12px';
    inputElement.style.fontSize = '14px';
    inputElement.placeholder = default_text;

    var buttonElement = document.createElement('button');
    buttonElement.type = 'button';
    buttonElement.id = button_id;
    buttonElement.style.backgroundColor = '#4CAF50';
    buttonElement.style.color = 'white';
    buttonElement.style.border = 'none';
    buttonElement.style.padding = '6px 20px';
    buttonElement.style.textAlign = 'center';
    buttonElement.style.textDecoration = 'none';
    buttonElement.style.display = 'inline-block';
    buttonElement.style.fontSize = '14px';
    buttonElement.style.height = '40px';
    buttonElement.style.cursor = 'pointer';
    buttonElement.style.borderRadius = '4px';
    buttonElement.textContent = button_text;

    paragraphElement.appendChild(valueLabel);

    containerDiv.appendChild(paragraphElement);
    containerDiv.appendChild(inputElement);
    containerDiv.appendChild(buttonElement);
    sidebar.appendChild(containerDiv);

    return {input: inputElement, button: buttonElement}
  }

  const addModifyInput = function (param, obj) {
    let index = 0;

    const dropdown = function (name, choices, label) {
        const domID = name + "_id";
        const template = [
      `<p>
        <label for='${domID}' class='badge bg-primary'>
        ${label}
        </label>
      </p>`,
      `<select
        id='${domID}'
        class='form-select'
        style='width:auto'
        aria-label='select input'>`,
    ];
        for (const idx in choices) {
          const choice = choices[idx];
          const selected = choice;
          template.push(`<option ${selected} value=${idx}>${choice}</option>`);
        }
        template.push("</select>");
        const div = document.createElement("div");
        div.innerHTML = template.join("");
        sidebar.appendChild(div);
        var select = document.getElementById(domID);
        return select
    }

    const addWhiteboard = function () {
        var paragraphElement = document.createElement('p');
        var valueLabel = document.createElement('label');
        valueLabel.className = 'badge bg-primary';
        valueLabel.textContent = 'Parameters';

        const whiteboard = document.createElement("div");
        whiteboard.setAttribute('id', 'whiteboard');
        whiteboard.style.border = "1px solid gray";
        whiteboard.style.borderRadius = "10px";
        whiteboard.style.height = "400px";
        whiteboard.style.width = "350px";
        whiteboard.style.overflow = "auto";
        whiteboard.style.padding = "10px";
        paragraphElement.appendChild(valueLabel);
        sidebar.appendChild(paragraphElement);
        sidebar.appendChild(whiteboard);

        for (const agent in obj.choices) {
            for (const attr in obj.choices[agent]) {
                const value = obj.choices[agent][attr];
                var para = document.createElement("p");
                para.style.padding = "2px";
                para.style.backgroundColor = index % 2 === 0 ? "#f2f2f2" : "white";
                para.innerHTML = `<b>${agent}</b>: <i>${attr}</i> = <span style='color:blue'>${value}</span>`;
                whiteboard.appendChild(para);
                index++;
            }
        }

        return whiteboard
    }

    const agentsDropdown = dropdown(param + "_agent", obj.choices_agent, 'Agent');
    const attrsDropdown = dropdown(param + "_attr", obj.choices_attr[obj.choices_agent[0]], 'Attribute');
    var default_value = obj.choices[agentsDropdown.options[0].text][attrsDropdown.options[0].text];

    const textInput = addTextInput('modify_value', 'modify_button', default_value, 'submit');
    const whiteboard = addWhiteboard();

    function populateAttrsDropdown() {
      var selectedAgent = obj.choices_agent[agentsDropdown.value];
      attrsDropdown.innerHTML = ''; // Clear existing options
      if (selectedAgent in obj.choices_attr) {
        var attrs = obj.choices_attr[selectedAgent];
        textInput.input.value = obj.choices[selectedAgent][attrs[0]];
        attrs.forEach(function(attr) {
          var option = document.createElement('option');
          option.textContent = attr;
          attrsDropdown.appendChild(option);
        });
      } else {
        var option = document.createElement('option');
        option.value = '';
        option.textContent = 'Select an agent first';
        attrsDropdown.appendChild(option);
      }
    };

    function populateWhiteboard() {
        // Clear the whiteboard
        whiteboard.innerHTML = '';

        // Populate the whiteboard with all parameters and their current values
        // Reset index to 0 each time we populate the whiteboard
        index = 0;
        for (const agent in obj.choices) {
            for (const attr in obj.choices[agent]) {
                const value = obj.choices[agent][attr];
                var para = document.createElement("p");
                para.style.padding = "2px";
                para.style.backgroundColor = index % 2 === 0 ? "#f2f2f2" : "white";
                para.innerHTML = `<b>${agent}</b>: <i>${attr}</i> = <span style='color:blue'>${value}</span>`;
                whiteboard.appendChild(para);
                index++;
            }
        }
    };

    populateAttrsDropdown();
    populateWhiteboard();
    agentsDropdown.onchange = () => populateAttrsDropdown();
    attrsDropdown.onchange = () => textInput.input.value = obj.choices[agentsDropdown.options[agentsDropdown.value].text][attrsDropdown.value];
    textInput.button.onclick = () =>
        { var agent = agentsDropdown.options[agentsDropdown.value].text;
          var attr = attrsDropdown.value;
          var value = textInput.input.value;
          send({ type: 'modify', agent: agent, attr: attr, value: value, container: param});
          obj.choices[agent][attr] = value

          var para = document.createElement("p");
          para.style.padding = "2px";
          para.style.backgroundColor = index % 2 === 0 ? "#f2f2f2" : "white";
          para.innerHTML = `<b>${agent}</b>: <i>${attr}</i> = <span style='color:blue'>${value}</span>`;
          whiteboard.appendChild(para);
          // No need to increase index here because it will be reset in populateWhiteboard

          populateWhiteboard();
        }

  }

  // const addModifyChoice = function (param, obj) {
  //   function createAllDropdowns(data, parent) {
  //       let dropdowns = [];
  //       let path = [];
  //       let labels = ['PO ID', 'Attribute', 'Options']
  //
  //       const getPathData = function(path) {
  //           let currentData = data;
  //           for (const key of path) {
  //               currentData = currentData[key];
  //           }
  //           return currentData;
  //       }
  //
  //       const createDropdown = function(level, choices) {
  //           const name = `level${level}`;
  //           const label = labels[level];
  //           const domID = name + "_id";
  //
  //           const div = document.createElement("div");
  //           const labelElement = document.createElement("label");
  //           labelElement.setAttribute("for", domID);
  //           labelElement.className = "badge bg-primary";
  //           labelElement.style.marginRight = "20px";
  //           labelElement.style.width = "100px";
  //           labelElement.innerText = label;
  //           div.appendChild(labelElement);
  //
  //           const select = document.createElement("select");
  //           select.id = domID;
  //           select.className = 'form-select';
  //           select.style = 'width:250px; display:inline-block';
  //           select.setAttribute('aria-label', 'select input');
  //
  //           for (const choice of choices) {
  //               const option = document.createElement("option");
  //               option.value = choice;
  //               option.text = choice;
  //               select.appendChild(option);
  //           }
  //
  //           select.addEventListener('change', function(e) {
  //               const selectedKey = e.target.value;
  //               path[level] = selectedKey;
  //               updateDropdowns(level + 1);
  //           });
  //
  //           div.appendChild(select);
  //           return div;
  //       }
  //
  //       const clearDropdown = function(level) {
  //           // Remove old options
  //           const select = dropdowns[level].querySelector('select');
  //           while (select.firstChild) {
  //               select.removeChild(select.firstChild);
  //           }
  //       }
  //
  //       const updateDropdowns = function(level) {
  //           const pathData = getPathData(path.slice(0, level));
  //           let choices;
  //           if (Array.isArray(pathData)) {
  //               choices = pathData;
  //           } else if(pathData) {
  //               choices = Object.keys(pathData);
  //           }
  //
  //           if (choices && choices.length > 0) {
  //               if (dropdowns.length <= level) {
  //                   const dropdown = createDropdown(level, choices);
  //                   dropdowns.push(dropdown);
  //                   parent.appendChild(dropdown);
  //               } else {
  //                   // Remove old options
  //                   const select = dropdowns[level].querySelector('select');
  //                   while (select.firstChild) {
  //                       select.removeChild(select.firstChild);
  //                   }
  //                   // Add new options
  //                   for (const choice of choices) {
  //                       const option = document.createElement("option");
  //                       option.value = choice;
  //                       option.text = choice;
  //                       select.appendChild(option);
  //                   }
  //               }
  //               path[level] = choices[0];
  //               updateDropdowns(level + 1);
  //           } else {
  //               // Clear lower level dropdowns if no choices are available
  //               for(let i = level; i < dropdowns.length; i++) {
  //                   clearDropdown(i);
  //               }
  //           }
  //       }
  //
  //       updateDropdowns(0);
  //   }
  //
  //   var buttonElement = document.createElement('button');
  //   buttonElement.type = 'button';
  //   buttonElement.id = 'submit_button';
  //   buttonElement.style.backgroundColor = '#4CAF50';
  //   buttonElement.style.color = 'white';
  //   buttonElement.style.border = 'none';
  //   buttonElement.style.padding = '6px 20px';
  //   buttonElement.style.textAlign = 'center';
  //   buttonElement.style.textDecoration = 'none';
  //   buttonElement.style.display = 'inline-block';
  //   buttonElement.style.fontSize = '14px';
  //   buttonElement.style.height = '40px';
  //   buttonElement.style.cursor = 'pointer';
  //   buttonElement.style.borderRadius = '4px';
  //   buttonElement.textContent = 'Submit';
  //
  //   // Usage:
  //   createAllDropdowns(obj.choices, sidebar);
  //   sidebar.appendChild(buttonElement);
  //
  // }

  const addModifyChoice2 = function (param, obj) {
    function createDropdowns(data, parent) {
        let dropdowns = {};

        const createTextbox = function(id, name) {
            const div = document.createElement("div");
            const textElement = document.createElement("textarea");
            textElement.id = id;
            textElement.style.marginTop = "2px";
            textElement.style.fontSize = '11px';
            textElement.style.display = "block";
            textElement.style.width = "200px";
            textElement.style.height = "40px";
            textElement.value = name;
            textElement.readOnly = true;
            div.appendChild(textElement);
            return div;
        }

        const createDropdown = function(id, name, choices=null, selectedValue=null) {
            const div = document.createElement("div");
            const labelElement = document.createElement("label");
            labelElement.setAttribute("for", id);
            labelElement.className = "badge bg-primary";
            labelElement.style.marginTop = "10px";
            labelElement.style.display = "block";
            labelElement.style.width = "200px";  // Set width of the label block
            labelElement.innerText = name;
            div.appendChild(labelElement);

            const select = document.createElement("select");
            select.id = id;
            select.className = 'form-select';
            select.style = 'width:200px; display:inline-block';
            select.setAttribute('aria-label', 'select input');

            if (choices !==null && selectedValue!==null) {
                var indicateFlag = true;
                for (const choice of choices) {
                    const option = document.createElement("option");
                    option.value = choice;
                    option.text = choice;
                    if (choice === selectedValue) {
                        option.selected = true;
                        indicateFlag = false;
                    }
                    select.appendChild(option);
                }
                if (indicateFlag==true) {
                    select.selectedIndex = -1;
                }
            }

            div.appendChild(select);
            return div;
        }

        const populateDropdown = function(select, choices, selectedValue) {
            while (select.firstChild) {
                select.removeChild(select.firstChild);
            }
            var indicateFlag = true;
            for (const choice of choices) {
                const option = document.createElement("option");
                option.value = choice;
                option.text = choice;
                if (choice === selectedValue) {
                    option.selected = true;
                    indicateFlag = false;
                }
                select.appendChild(option);
            }
            if (indicateFlag==true) {
                select.selectedIndex = -1;
            }
        }

        const firstIdData = data[Object.keys(data)[0]];
        dropdowns.id = createDropdown('id', 'Purchase ID', Object.keys(data), Object.keys(data)[0]);
        textSupplier = createTextbox('textSupplier', 'Default supplier: '+firstIdData.textSupplier.value);
        textL2 = createTextbox('textL2', 'L2: '+firstIdData.textL2.value);
        textL3 = createTextbox('textL3', 'L3: '+firstIdData.textL3.value);
        textL4 = createTextbox('textL4', 'L4: '+firstIdData.textL4.value);
        textTrans = createTextbox('textTrans', 'Transportation: '+firstIdData.textTrans.value);
        textInnerTrans = createTextbox('textInnerTrans', 'Inner transportation: '+firstIdData.textInnerTrans.value);
        dropdowns.level = createDropdown('level', 'Category Level', firstIdData.level.options, firstIdData.level.value);
        dropdowns.supplier = createDropdown('supplier', 'Competitor', firstIdData.supplier.options, firstIdData.supplier.value);
        dropdowns.transition = createDropdown('transition', 'Transportation Method', firstIdData.transition.options, firstIdData.transition.value);
        dropdowns.inner_transition = createDropdown('inner_transition', 'Inner Transportation Method', firstIdData.inner_transition.options, firstIdData.inner_transition.value);

        parent.appendChild(dropdowns.id);
        parent.appendChild(textSupplier);
        parent.appendChild(textL2);
        parent.appendChild(textL3);
        parent.appendChild(textL4);
        parent.appendChild(textTrans);
        parent.appendChild(textInnerTrans);
        parent.appendChild(dropdowns.level)
        parent.appendChild(dropdowns.supplier);
        parent.appendChild(dropdowns.transition);
        parent.appendChild(dropdowns.inner_transition);

        // Add event listener to ID dropdown
        document.getElementById('id').addEventListener('change', function(e) {
            const selectedId = e.target.value;
            const idData = data[selectedId];

            document.getElementById('textSupplier').value = 'Default supplier: '+idData.textSupplier.value;
            document.getElementById('textL2').value = 'L2: '+idData.textL2.value;
            document.getElementById('textL3').value = 'L3: '+idData.textL3.value;
            document.getElementById('textL4').value = 'L4: '+idData.textL4.value;
            document.getElementById('textTrans').value = 'Transportation: '+idData.textTrans.value;
            document.getElementById('textInnerTrans').value = 'Inner transportation: '+idData.textInnerTrans.value;

            // Populate supplier dropdown
            populateDropdown(document.getElementById('level'), idData.level.options, idData.level.value);
            // Populate supplier dropdown
            populateDropdown(document.getElementById('supplier'), idData.supplier.options, idData.supplier.value);
            // Populate transition dropdown
            populateDropdown(document.getElementById('transition'), idData.transition.options, idData.transition.value);

            populateDropdown(document.getElementById('inner_transition'), idData.inner_transition.options, idData.inner_transition.value);

        });

        // Add event listener to level dropdown
        document.getElementById('level').addEventListener('change', function(e) {
            const selectedId = document.getElementById('id').value;
            const idData = data[selectedId];
            const selectedLevel = e.target.value;

            if (selectedLevel == "L2") {
                populateDropdown(document.getElementById('supplier'), idData.supplier.options, idData.supplier.value);
            }

            // Populate supplier dropdown
            if (selectedLevel == "L3") {
                populateDropdown(document.getElementById('supplier'), idData.l3supplier.options, idData.l3supplier.value);
            }

            // Populate supplier dropdown
            if (selectedLevel == 'L4') {
                populateDropdown(document.getElementById('supplier'), idData.l4supplier.options, idData.l4supplier.value);
            }

        });


        // Add button
        var buttonElement = document.createElement('button');
        buttonElement.type = 'button';
        buttonElement.id = 'submit_button';
        buttonElement.style.backgroundColor = '#4CAF50';
        buttonElement.style.color = 'white';
        buttonElement.style.border = 'none';
        buttonElement.style.padding = '6px 20px';
        buttonElement.style.textAlign = 'center';
        buttonElement.style.textDecoration = 'none';
        buttonElement.style.display = 'inline-block';
        buttonElement.style.fontSize = '14px';
        buttonElement.style.height = '40px';
        buttonElement.style.cursor = 'pointer';
        buttonElement.style.borderRadius = '4px';
        buttonElement.style.marginTop = "10px";
        buttonElement.style.marginBottom = "10px";
        buttonElement.textContent = 'Submit';

        buttonElement.addEventListener("click", function() {
            let id = document.getElementById('id').value;
            let supplier = document.getElementById('supplier').value;
            let transition = document.getElementById('transition').value;
            let inner_transition = document.getElementById('inner_transition').value;
            send({ 'type': 'modify', 'container': 'parameters', 'id': id, 'supplier': supplier, 'transition': transition, 'inner_transition': inner_transition})

            data[id].supplier.value = supplier;
            data[id].transition.value = transition;
            data[id].inner_transition.value = inner_transition

            let whiteboard = document.getElementById('whiteboard');
            parent.removeChild(whiteboard);
            whiteboard = addWhiteboard(data);
            // parent.appendChild(whiteboard);
            const refElement = parent.children[parent.children.length-1];
            parent.insertBefore(whiteboard, refElement);
        });
        parent.appendChild(buttonElement);

        const whiteboard = addWhiteboard(data);
        parent.appendChild(whiteboard);
    }

    function addWhiteboard(data) {
        const whiteboard = document.createElement("div");
        whiteboard.setAttribute('id', 'whiteboard');
        whiteboard.style.border = "1px solid gray";
        whiteboard.style.borderRadius = "10px";
        whiteboard.style.height = "400px";
        whiteboard.style.width = "350px";
        whiteboard.style.overflow = "auto";
        whiteboard.style.padding = "10px";

        let index = 0;
        for (const id in data) {
            const supplier = data[id].supplier.value;
            const transition = data[id].transition.value;
            const inner_transition = data[id].inner_transition.value;
            const para = document.createElement("p");
            para.style.padding = "2px";
            para.style.backgroundColor = index % 2 === 0 ? "#f2f2f2" : "white";
            // modify the frame
            // if id !=0:
            // para.innerHTML = `<b>${id}</b>: Supplier = <span style='color:blue'>${supplier}</span>, Transition = <span style='color:blue'>${transition}</span>`;
            // else:
            para.innerHTML = `<b>${id}</b>: Supplier = <span style='color:blue'>${supplier}</span>, Transition = <span style='color:blue'>${transition}</span>,  Inner_Transition = <span style='color:blue'>${inner_transition}</span>`;
            whiteboard.appendChild(para);
            index++;
        }

    return whiteboard;
}

    createDropdowns(obj.choices, sidebar);

  }

  const addNewChoice = function (param, obj) {
    const domID = param + "_id";
    const template = [
      `<p></p>
        <label for='${domID}' class='badge bg-primary'>
        ${obj.name}
        </label>
      `,
      `<select
        id='${domID}'
        class='form-select'
        style='width:200px'
        aria-label='select input'>`,
    ];
    for (const idx in obj.choices) {
      const choice = obj.choices[idx];
      const selected = choice === obj.value ? "selected" : "";
      template.push(`<option ${selected} value=${idx}>${choice}</option>`);
    }

    // Close the select options
    template.push("</select>");

    // Finally render the dropdown and activate choice listeners
    const div = document.createElement("div");
    div.innerHTML = template.join("");
    sidebar.appendChild(div);

    document.getElementById(domID).selectedIndex = -1;

    const select = document.getElementById(domID);
    select.onchange = () => {
        // const chartElement = document.getElementById('Trans')
        // if (chartElement.style.display === "none") {
        //     chartElement.style.display = "block";
        // }
        // else{
        //     chartElement.style.display = "none";
        // }
        // const datasets = [];
        //
        //
        // const convertColorOpacity = (hex) => {
        //   if (hex.indexOf("#") != 0) {
        //     return "rgba(0,0,0,0.1)";
        //   }
        //
        //   hex = hex.replace("#", "");
        //   const r = parseInt(hex.substring(0, 2), 16);
        //   const g = parseInt(hex.substring(2, 4), 16);
        //   const b = parseInt(hex.substring(4, 6), 16);
        //   return `rgba(${r},${g},${b},0.1)`;
        // };
        // const new_series = {
        //     label: 'll',
        //     borderColor: '#0000FF',
        //     backgroundColor: convertColorOpacity('#0000FF'),
        //     data: [],
        // };
        //   datasets.push(new_series);

        // lastone = chartElements.lastElementChild;
        // lastone.data=datasets;
        // lastone.update();

        const selectedValue = select.value;
        switch (selectedValue) {
            case '0':
                window.scrollTo(0, 1680);
                break;
            case '1':
                window.scrollTo(0, 1970);
                break;
            case '2':
                window.scrollTo(0, 2320);
                break;
            case '3':
                window.scrollTo(0, 2670);
                break;
            case '4':
                window.scrollTo(0, 3020);
                break;
            case '5':
                window.scrollTo(0, 3370);
                break;
            case '6':
                window.scrollTo(0, 3720);
                break;
            case '7':
                window.scrollTo(0, 4070);
                break;
            case '8':
                window.scrollTo(0, 4420);
                break;
            case '9':
                window.scrollTo(0, 4770);
                break;
            case '10':
                window.scrollTo(0, 5020);
                break;
        }
    };

  };


  const addParamInput = function (param, option) {
    switch (option["param_type"]) {
      case "checkbox":
        addBooleanInput(param, option);
        break;

      case "slider":
        addSliderInput(param, option);
        break;

      case "choice":
        addChoiceInput(param, option);
        break;

      case "number":
        addNumberInput(param, option); // Behaves the same as just a simple number
        break;

      case "static_text":
        addTextBox(param, option);
        break;

      case "modify_input":
        addModifyInput(param, option);
        break;

      case "modify_choice":
        addModifyChoice2(param, option);
        break;
      case "new_choice":
        addNewChoice(param, option);
        break;
    }
  };

  for (const option in model_params) {
    const type = typeof model_params[option];
    const param_str = String(option);

    switch (type) {
      case "boolean":
        addBooleanInput(param_str, {
          value: model_params[option],
          name: param_str,
        });
        break;
      case "number":
        addNumberInput(param_str, {
          value: model_params[option],
          name: param_str,
        });
        break;
      case "object":
        addParamInput(param_str, model_params[option]); // catch-all for params that use Option class
        break;
    }
  }
};

// Backward-Compatibility aliases
const control = controller;
const elements = vizElements;
