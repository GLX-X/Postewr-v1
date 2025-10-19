import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

// --- DOM Element Selectors ---
const logoUpload = document.getElementById('logo-upload') as HTMLInputElement;
const logoPreview = document.getElementById('logo-preview') as HTMLImageElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const getSuggestionBtn = document.getElementById('get-suggestion-btn') as HTMLButtonElement;
const suggestionText = document.getElementById('suggestion-text') as HTMLParagraphElement;
const useSuggestionBtn = document.getElementById('use-suggestion-btn') as HTMLButtonElement;
const suggestionKeywordsInput = document.getElementById('suggestion-keywords-input') as HTMLInputElement;
const styleInput = document.getElementById('style-input') as HTMLInputElement;
const stylePresetSelect = document.getElementById('style-preset-select') as HTMLSelectElement;
const colorPresetSelect = document.getElementById('color-preset-select') as HTMLSelectElement;
const customColorInputsContainer = document.getElementById('custom-color-inputs') as HTMLDivElement;
const getStyleBtn = document.getElementById('get-style-btn') as HTMLButtonElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const posterNameInput = document.getElementById('poster-name-input') as HTMLInputElement;
const dateInput = document.getElementById('date-input') as HTMLInputElement;
const timeInput = document.getElementById('time-input') as HTMLInputElement;
const venueInput = document.getElementById('venue-input') as HTMLInputElement;
const extraInput = document.getElementById('extra-input') as HTMLInputElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const customWidthInput = document.getElementById('custom-width-input') as HTMLInputElement;
const customHeightInput = document.getElementById('custom-height-input') as HTMLInputElement;

// Canvas State Selectors
const placeholder = document.getElementById('placeholder') as HTMLDivElement;
const resultContainer = document.getElementById('result-container') as HTMLDivElement;
const loadingState = document.getElementById('loading-state') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLDivElement;
const errorText = document.getElementById('error-text') as HTMLParagraphElement;
const resultImage = document.getElementById('result-image') as HTMLImageElement;
const downloadBtn = document.getElementById('download-btn') as HTMLAnchorElement;

// --- State Variables ---
let logoFile: File | null = null;
let logoBase64: string | null = null;
let selectedResolution = "1080x1920"; // Default resolution

interface TextStyle {
    font: string;
    size: number;
    color: string;
}
const textStyles: { [key: string]: TextStyle } = {};


// --- Constants ---
const PALETTE_PRESETS: { [key: string]: string[] } = {
    sunset: ["#FFC371", "#FF5F6D", "#A43931", "#4A2529", "#1B1B1B"],
    ocean: ["#0052D4", "#4364F7", "#6FB1FC", "#B2FEFA", "#FFFFFF"],
    forest: ["#134E5E", "#71B280", "#E8DEB5", "#AD885A", "#4E2C21"],
    monochrome: ["#000000", "#434343", "#888888", "#DDDDDD", "#FFFFFF"],
    neon: ["#FF00FF", "#00FFFF", "#FFFF00", "#FF0000", "#0000FF"],
};

/**
 * Gets a GoogleGenAI client instance.
 * It prioritizes a user-provided key from the input field,
 * otherwise falls back to the environment variable.
 * @returns An instance of GoogleGenAI.
 * @throws An error if no API key is available.
 */
const getAiClient = (): GoogleGenAI => {
    const customApiKey = apiKeyInput.value.trim();
    const apiKey = customApiKey || process.env.API_KEY;

    if (!apiKey) {
        throw new Error("API Key is missing. Please provide a custom key or configure the environment.");
    }
    return new GoogleGenAI({ apiKey });
};


/**
 * Converts a File/Blob object to a Base64 encoded string.
 * @param blob The file or blob to convert.
 * @returns A promise that resolves with the Base64 string.
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Toggles the loading state of a button.
 * @param button The button element.
 * @param isLoading True to show spinner, false to show text.
 */
const setButtonLoading = (button: HTMLButtonElement, isLoading: boolean) => {
    const spinner = button.querySelector('.spinner');
    const btnText = button.querySelector('.btn-text');
    button.disabled = isLoading;
    if (isLoading) {
        spinner?.classList.remove('hidden');
        btnText?.classList.add('hidden');
    } else {
        spinner?.classList.add('hidden');
        btnText?.classList.remove('hidden');
    }
};

/**
 * Creates a ripple effect on a button click.
 * @param event The click event.
 */
const createRipple = (event: MouseEvent) => {
    const button = event.currentTarget as HTMLElement;

    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    const rect = button.getBoundingClientRect();

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add("ripple");

    const existingRipple = button.querySelector(".ripple");
    if (existingRipple) {
      existingRipple.remove();
    }

    button.appendChild(circle);

    circle.addEventListener('animationend', () => {
        circle.remove();
    });
};


/**
 * Manages the visibility of different states in the canvas area.
 * @param state The state to show: 'placeholder', 'loading', 'result', or 'error'.
 */
const setCanvasState = (state: 'placeholder' | 'loading' | 'result' | 'error') => {
    [placeholder, loadingState, resultContainer, errorMessage].forEach(el => el.classList.add('hidden'));
    switch (state) {
        case 'placeholder': placeholder.classList.remove('hidden'); break;
        case 'loading': loadingState.classList.remove('hidden'); break;
        case 'result': resultContainer.classList.remove('hidden'); break;
        case 'error': errorMessage.classList.remove('hidden'); break;
    }
}

/**
 * Displays an error message in the UI.
 * @param message The error message to display.
 */
const displayError = (message: string) => {
    setCanvasState('error');
    errorText.textContent = message;
};

/**
 * Handles the selection of a logo file.
 */
const handleLogoChange = async () => {
    if (logoUpload.files && logoUpload.files[0]) {
        logoFile = logoUpload.files[0];
        try {
            logoBase64 = await blobToBase64(logoFile);
            logoPreview.src = logoBase64;
            logoPreview.classList.remove('hidden');
        } catch (error) {
            console.error("Error reading file:", error);
            logoFile = null;
            logoBase64 = null;
            logoPreview.classList.add('hidden');
            displayError("Could not read the selected logo file.");
        }
    }
};

/**
 * Generates and displays a unique artistic style suggestion.
 */
const generateStyleSuggestion = async () => {
    getStyleBtn.disabled = true;
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Generate a single, unique, and creative artistic style for a poster. Combine concepts or be highly specific. Examples: 'Swiss Punk Typography', 'Neo-Brutalist with holographic foil accents', 'Japanese Ukiyo-e woodblock printing style, but with a cyberpunk theme'. Provide only the style name.",
        });
        styleInput.value = response.text.trim();
        stylePresetSelect.value = ""; // Reset dropdown if a custom style is generated
    } catch (error: any) {
        console.error("Style suggestion error:", error);
        displayError(error.message || "Could not generate style suggestion.");
        styleInput.value = "Minimalist Retro"; // Fallback
    } finally {
        getStyleBtn.disabled = false;
    }
};

/**
 * Handles the change event for the style preset dropdown.
 */
const handleStylePresetChange = () => {
    if (stylePresetSelect.value) {
        styleInput.value = stylePresetSelect.value;
    }
};


/**
 * Populates the custom color inputs with a given set of colors.
 * @param colors An array of hex color strings.
 */
const setCustomColors = (colors: string[]) => {
    const colorSwatches = customColorInputsContainer.querySelectorAll<HTMLDivElement>('.color-swatch');
    for (let i = 0; i < 5; i++) {
        const color = colors[i] || '#000000';
        if (colorSwatches[i]) {
            const picker = colorSwatches[i].previousElementSibling as HTMLInputElement;
            picker.value = color;
            colorSwatches[i].style.backgroundColor = color;
            (colorSwatches[i].dataset as any).color = color;
        }
    }
};

/**
 * Handles the change event for the color preset dropdown.
 */
const handleColorPresetChange = () => {
    const selectedPalette = colorPresetSelect.value;
    if (PALETTE_PRESETS[selectedPalette]) {
        setCustomColors(PALETTE_PRESETS[selectedPalette]);
    }
};

/**
 * Generates and displays a prompt suggestion.
 */
const generatePromptSuggestion = async () => {
    getSuggestionBtn.disabled = true;
    suggestionText.textContent = "Generating...";
    useSuggestionBtn.disabled = true;
    try {
        const ai = getAiClient();
        const currentUserPrompt = promptInput.value ? `The user is already thinking about: "${promptInput.value}".` : "The user has not provided any initial ideas.";
        const keywords = suggestionKeywordsInput.value.trim();
        const keywordsPromptPart = keywords ? `Incorporate these guiding keywords: "${keywords}".` : '';

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Based on the user's current idea (${currentUserPrompt}) ${keywordsPromptPart}, generate one new, detailed, and imaginative prompt for a poster. The prompt should describe visual elements, colors, and mood. Be concise and inspiring.`,
        });
        suggestionText.textContent = response.text.trim();
        useSuggestionBtn.disabled = false;
    } catch (error: any) {
        console.error("Prompt suggestion error:", error);
        suggestionText.textContent = "Could not generate a suggestion.";
    } finally {
        getSuggestionBtn.disabled = false;
    }
};

/**
 * Uses the generated suggestion in the main prompt input.
 */
const useSuggestion = () => {
    promptInput.value = suggestionText.textContent || '';
};

/**
 * Main function to generate the poster.
 */
const generatePoster = async () => {
    if (!promptInput.value) {
        alert("Please enter a description for your poster.");
        return;
    }

    setButtonLoading(generateBtn, true);
    setCanvasState('loading');

    try {
        const ai = getAiClient();
        
        let designBrief = `**Design Brief: Create a Professional Event Poster**\n\n`;
        designBrief += `**1. Core Concept & Description:**\n"${promptInput.value}"\n\n`;

        const textElements = [
            { label: "Event Name", value: posterNameInput.value, id: posterNameInput.id },
            { label: "Date", value: dateInput.value, id: dateInput.id },
            { label: "Time", value: timeInput.value, id: timeInput.id },
            { label: "Venue", value: venueInput.value, id: venueInput.id },
            { label: "Extra Info", value: extraInput.value, id: extraInput.id },
        ].filter(el => el.value.trim() !== "");

        if (textElements.length > 0) {
            designBrief += `**2. Mandatory Text Elements (Must be clearly visible, legible, and accurately spelled, with specific styling):**\n`;
            textElements.forEach(el => {
                const style = textStyles[el.id];
                let styleInstruction = "";
                if (style) {
                    styleInstruction = ` (Style instructions: Use a font similar to '${style.font}', make the font size relative to a prominent '${style.size}pt', and the color must be exactly '${style.color}')`;
                }
                designBrief += `- ${el.label}: "${el.value}"${styleInstruction}\n`;
            });
            designBrief += `\n`;
        }

        designBrief += `**3. Artistic Style:**\n- Style: ${styleInput.value || 'As described in the core concept'}\n\n`;

        const colorSwatches = customColorInputsContainer.querySelectorAll<HTMLDivElement>('.color-swatch');
        const customColors = Array.from(colorSwatches).map(swatch => (swatch.dataset as any).color).filter(Boolean);
        if (customColors.length > 0) {
            designBrief += `**4. Color Palette (Strict Requirement):**\n- The design must be built around this specific color palette: ${customColors.join(', ')}.\n\n`;
        }

        designBrief += `**5. Final Instructions & Constraints:**\n`;
        if (logoBase64 && logoFile) {
            designBrief += `- Subtly and professionally integrate the provided logo into the design. It should complement the overall aesthetic, not dominate it.\n`;
        }
        designBrief += `- The final output must be a single, complete poster design.\n`;
        designBrief += `- Do NOT use any placeholder text (e.g., 'Lorem Ipsum').\n`;
        designBrief += `- Poster Dimensions: ${selectedResolution}px.\n`;


        const parts: any[] = [{ text: designBrief }];

        if (logoBase64 && logoFile) {
            parts.push({
                inlineData: {
                    data: logoBase64.split(',')[1],
                    mimeType: logoFile.type,
                },
            });
        }
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart?.inlineData) {
            const base64ImageData = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType;
            const imageUrl = `data:${mimeType};base64,${base64ImageData}`;
            resultImage.src = imageUrl;
            downloadBtn.href = imageUrl;
            setCanvasState('result');
        } else {
            throw new Error("No image was generated. The model might have refused the prompt. Try being more specific or adjusting your request.");
        }

    } catch (error: any) {
        console.error("Poster generation error:", error);
        displayError(error.message || "An unknown error occurred during poster generation.");
    } finally {
        setButtonLoading(generateBtn, false);
    }
};

/**
 * Resets the entire form to its initial state.
 */
const resetForm = () => {
    // Clear inputs
    promptInput.value = '';
    posterNameInput.value = '';
    dateInput.value = '';
    timeInput.value = '';
    venueInput.value = '';
    extraInput.value = '';
    suggestionKeywordsInput.value = '';
    apiKeyInput.value = '';
    customWidthInput.value = '';
    customHeightInput.value = '';

    // Reset logo
    logoUpload.value = '';
    logoFile = null;
    logoBase64 = null;
    logoPreview.src = '';
    logoPreview.classList.add('hidden');

    // Reset suggestion box
    suggestionText.textContent = "Get a creative prompt suggestion...";
    useSuggestionBtn.disabled = true;

    // Reset customizations
    stylePresetSelect.value = "";
    generateStyleSuggestion(); // Fetch a new random style
    colorPresetSelect.value = "sunset";
    handleColorPresetChange(); // Set colors to default

    // Reset text styles
    document.querySelectorAll('.style-controls').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.style-toggle-btn').forEach(el => el.classList.remove('active'));
    // Could also reset the values of the style inputs here if needed
    Object.keys(textStyles).forEach(key => delete textStyles[key]);


    // Reset resolution
    selectedResolution = "1080x1920";
    document.querySelectorAll('.resolution-btn').forEach(btn => btn.classList.remove('active'));
    const defaultResBtn = document.querySelector('.resolution-btn[data-resolution="1080x1920"]');
    if(defaultResBtn) defaultResBtn.classList.add('active');

    // Reset canvas
    setCanvasState('placeholder');
    resultImage.src = '';
    downloadBtn.href = '#';
    
    // Uncollapse first section
    const firstSection = document.querySelector('.control-section') as HTMLDetailsElement;
    if (firstSection) firstSection.open = true;
}


/**
 * Initializes the application, sets up the AI client and event listeners.
 */
const init = () => {
    // Populate custom color inputs
    for (let i = 0; i < 5; i++) {
        const group = document.createElement('div');
        group.className = 'color-input-group';

        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = '#000000';
        
        const colorSwatch = document.createElement('div');
        colorSwatch.className = 'color-swatch';
        colorSwatch.classList.add('color-swatch'); // Add a class for easier selection
        (colorSwatch.dataset as any).color = colorPicker.value;
        colorSwatch.style.backgroundColor = colorPicker.value;


        colorPicker.addEventListener('input', () => {
            colorSwatch.style.backgroundColor = colorPicker.value;
            (colorSwatch.dataset as any).color = colorPicker.value;
        });
        
        colorSwatch.addEventListener('click', () => colorPicker.click());


        group.appendChild(colorPicker);
        group.appendChild(colorSwatch);
        customColorInputsContainer.appendChild(group);
    }
        
    // --- Event Listeners ---
    logoUpload.addEventListener('change', handleLogoChange);
    getStyleBtn.addEventListener('click', generateStyleSuggestion);
    stylePresetSelect.addEventListener('change', handleStylePresetChange);
    colorPresetSelect.addEventListener('change', handleColorPresetChange);
    getSuggestionBtn.addEventListener('click', generatePromptSuggestion);
    useSuggestionBtn.addEventListener('click', useSuggestion);
    generateBtn.addEventListener('click', generatePoster);
    resetBtn.addEventListener('click', resetForm);
    
    const resolutionButtons = document.querySelectorAll<HTMLButtonElement>('.resolution-btn');
    resolutionButtons.forEach(button => {
        button.addEventListener('click', () => {
            resolutionButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedResolution = button.dataset.resolution || "1080x1920";
            const [width, height] = selectedResolution.split('x');
            customWidthInput.value = width;
            customHeightInput.value = height;
        });
    });

    const handleCustomSizeInput = () => {
        const width = customWidthInput.value;
        const height = customHeightInput.value;
        if (width && height) {
            selectedResolution = `${width}x${height}`;
            resolutionButtons.forEach(btn => btn.classList.remove('active'));
        }
    };

    customWidthInput.addEventListener('input', handleCustomSizeInput);
    customHeightInput.addEventListener('input', handleCustomSizeInput);


    const buttons = document.querySelectorAll('button, label.button, #download-btn');
    buttons.forEach(button => {
        button.addEventListener('click', createRipple as EventListener);
    });

    // --- Text Styling Listeners ---
    document.querySelectorAll('.style-toggle-btn').forEach(button => {
        button.addEventListener('click', () => {
            const controls = button.closest('.text-input-group')?.querySelector('.style-controls');
            if (controls) {
                controls.classList.toggle('active');
                button.classList.toggle('active');
            }
        });
    });

    const updateTextStyle = (targetId: string, styleProp: keyof TextStyle, value: any) => {
        if (!textStyles[targetId]) {
            // Initialize with default values if not present
            const styleControls = document.querySelector(`.style-controls [data-target="${targetId}"]`)?.closest('.style-controls');
            if(styleControls){
                 const fontSelect = styleControls.querySelector('.font-select') as HTMLSelectElement;
                 const fontSizeInput = styleControls.querySelector('.font-size-input') as HTMLInputElement;
                 const fontColorInput = styleControls.querySelector('.font-color-input') as HTMLInputElement;
                 textStyles[targetId] = {
                    font: fontSelect.value,
                    size: parseInt(fontSizeInput.value) || 32,
                    color: fontColorInput.value
                 };
            }
        }
        (textStyles[targetId] as any)[styleProp] = value;
    };
    
    document.querySelectorAll('.font-select').forEach(select => {
        const input = select as HTMLSelectElement;
        const targetId = input.dataset.target!;
        updateTextStyle(targetId, 'font', input.value);
        input.addEventListener('change', () => updateTextStyle(targetId, 'font', input.value));
    });

    document.querySelectorAll('.font-size-input').forEach(input => {
        const el = input as HTMLInputElement;
        const targetId = el.dataset.target!;
        updateTextStyle(targetId, 'size', parseInt(el.value));
        el.addEventListener('input', () => updateTextStyle(targetId, 'size', parseInt(el.value)));
    });

    document.querySelectorAll('.font-color-input').forEach(input => {
        const el = input as HTMLInputElement;
        const targetId = el.dataset.target!;
        updateTextStyle(targetId, 'color', el.value);
        el.addEventListener('input', () => updateTextStyle(targetId, 'color', el.value));
    });


    // Initial setup
    generateStyleSuggestion();
    setCustomColors(PALETTE_PRESETS.sunset);
    colorPresetSelect.value = "sunset";
    const defaultResBtn = document.querySelector('.resolution-btn.active');
    if (defaultResBtn) {
         const [width, height] = (defaultResBtn as HTMLElement).dataset.resolution!.split('x');
         customWidthInput.value = width;
         customHeightInput.value = height;
    }
};

// --- Start the application ---
init();