/**
 * Chiro Huddle - Main Application
 * Evening Huddle workflow with 7 categories
 */

const App = {
    // Workflow State
    currentSectionIndex: 0,
    patients: [],

    // Section Definitions (7 categories)
    sections: [
        {
            id: 'pmtIssues',
            name: 'PMT Issues',
            icon: '💰',
            description: 'Track payment issues and missed payments',
            type: 'patient-note',
            exportable: true
        },
        {
            id: 'insuranceQuestions',
            name: 'Insurance Questions',
            icon: '🏥',
            description: 'Insurance questions and follow-ups',
            type: 'patient-note',
            exportable: true
        },
        {
            id: 'noAppt',
            name: 'No Appt',
            icon: '📵',
            description: 'No-shows and cancellations without reschedule',
            type: 'patient-note',
            exportable: true
        },
        {
            id: 'chargePassdown',
            name: 'Charge and Passdown',
            icon: '📋',
            description: 'Charge codes and passdown items',
            type: 'charge-multiselect',
            exportable: true
        },
        {
            id: 'todo24',
            name: '24 Hour To-Do',
            icon: '📝',
            description: 'Tasks to complete in the next 24 hours',
            type: 'todo-list',
            screen: 'todoSectionScreen',
            exportable: true
        },
        {
            id: 'chiro180',
            name: 'Chiro 180 Updates',
            icon: '📱',
            description: 'Track Chiro 180 app update status',
            type: 'toggle-list',
            screen: 'chiro180SectionScreen',
            exportable: true
        },
        {
            id: 'insuranceVerify',
            name: 'Insurance Verification',
            icon: '✅',
            description: 'Confirm insurance verification status',
            type: 'checkbox-list',
            screen: 'insuranceVerifySectionScreen',
            exportable: true
        }
    ],

    // Quick Notes by Section
    quickNotes: {
        pmtIssues: ['Missed payment', 'Payment plan needed', 'Past due balance', 'Card declined', 'Needs statement'],
        insuranceQuestions: ['Benefits check needed', 'Pre-auth required', 'Claim follow-up', 'Coverage question', 'Referral needed'],
        noAppt: ['No call/No show', 'Cancelled with no appointment', 'Left message', 'Needs to reschedule', 'Will call back']
    },

    // Charge Codes for Charge & Passdown section
    chargeCodes: [
        '98940', '98941', '98943', '97140',
        'piezo', 'laser', 'shockwave', 'decomp',
        'KOT', 'normatec', 'dakota traction',
        'progress exam', 'normal exam',
        'lumbar x-rays', 'cervical x-rays', 'x-rays unspecified'
    ],

    // Passcode State
    currentPasscode: '',
    setupPasscode: '',
    setupConfirm: false,
    setupFirstPasscode: '',

    // Lock Timer
    lockTimer: null,
    lockTimeout: 5 * 60 * 1000,

    // Data
    huddleData: null,
    settings: null,

    // Modal State
    currentPatient: null,
    selectedQuickNote: null,
    selectedChargeCodes: [],

    // DOM Elements
    elements: {},

    // Initialize
    async init() {
        this.cacheElements();
        this.bindEvents();
        this.updateDateDisplay();

        // Initialize Google Drive (non-blocking)
        this.initGoogleDrive();

        if (StorageManager.isSetUp()) {
            this.showLockScreen();
        } else {
            this.showSetupScreen();
        }
    },

    // Cache DOM Elements
    cacheElements() {
        this.elements = {
            // Screens
            lockScreen: document.getElementById('lockScreen'),
            setupScreen: document.getElementById('setupScreen'),
            mainApp: document.getElementById('mainApp'),

            // Lock Screen
            passcodeDots: document.querySelectorAll('#lockScreen .passcode-display .dot'),
            numBtns: document.querySelectorAll('#lockScreen .num-btn[data-num]'),
            deleteBtn: document.getElementById('deleteBtn'),
            biometricBtn: document.getElementById('biometricBtn'),
            errorMsg: document.getElementById('errorMsg'),

            // Setup Screen
            setupDots: document.querySelectorAll('#setupScreen .passcode-display .dot'),
            setupNumBtns: document.querySelectorAll('#setupScreen .num-btn[data-num]'),
            setupDeleteBtn: document.getElementById('setupDeleteBtn'),
            setupStatus: document.getElementById('setupStatus'),

            // Workflow Screens
            homeScreen: document.getElementById('homeScreen'),
            patientListScreen: document.getElementById('patientListScreen'),
            huddleSectionScreen: document.getElementById('huddleSectionScreen'),
            todoSectionScreen: document.getElementById('todoSectionScreen'),
            chiro180SectionScreen: document.getElementById('chiro180SectionScreen'),
            insuranceVerifySectionScreen: document.getElementById('insuranceVerifySectionScreen'),
            completionScreen: document.getElementById('completionScreen'),

            // Home Screen
            dateDisplay: document.getElementById('dateDisplay'),
            startEveningBtn: document.getElementById('startEveningBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            lockBtn: document.getElementById('lockBtn'),

            // Patient List Screen
            patientListTitle: document.getElementById('patientListTitle'),
            patientPaste: document.getElementById('patientPaste'),
            loadPatients: document.getElementById('loadPatients'),
            clearPaste: document.getElementById('clearPaste'),
            loadedPatients: document.getElementById('loadedPatients'),
            patientCountDisplay: document.getElementById('patientCountDisplay'),
            continueToHuddle: document.getElementById('continueToHuddle'),
            backToHome: document.getElementById('backToHome'),

            // Huddle Section Screen
            sectionTitle: document.getElementById('sectionTitle'),
            stepIndicator: document.getElementById('stepIndicator'),
            progressBar: document.getElementById('progressBar'),
            sectionIcon: document.getElementById('sectionIcon'),
            sectionDescription: document.getElementById('sectionDescription'),
            itemCountBadge: document.getElementById('itemCountBadge'),
            addedItemsList: document.getElementById('addedItemsList'),
            patientGrid: document.getElementById('patientGrid'),
            exportSectionBtn: document.getElementById('exportSectionBtn'),
            nextSectionBtn: document.getElementById('nextSectionBtn'),
            backToPrevSection: document.getElementById('backToPrevSection'),

            // To-Do Section
            todoInput: document.getElementById('todoInput'),
            addTodoBtn: document.getElementById('addTodoBtn'),
            todoList: document.getElementById('todoList'),
            todoProgressBar: document.getElementById('todoProgressBar'),
            todoStepIndicator: document.getElementById('todoStepIndicator'),
            backFromTodo: document.getElementById('backFromTodo'),
            nextFromTodo: document.getElementById('nextFromTodo'),
            exportTodoBtn: document.getElementById('exportTodoBtn'),

            // Chiro 180 Section
            chiro180List: document.getElementById('chiro180List'),
            chiro180ProgressBar: document.getElementById('chiro180ProgressBar'),
            chiro180StepIndicator: document.getElementById('chiro180StepIndicator'),
            backFromChiro180: document.getElementById('backFromChiro180'),
            nextFromChiro180: document.getElementById('nextFromChiro180'),
            exportChiro180Btn: document.getElementById('exportChiro180Btn'),

            // Insurance Verification Section
            insuranceVerifyList: document.getElementById('insuranceVerifyList'),
            insVerifyProgressBar: document.getElementById('insVerifyProgressBar'),
            insVerifyStepIndicator: document.getElementById('insVerifyStepIndicator'),
            backFromInsVerify: document.getElementById('backFromInsVerify'),
            nextFromInsVerify: document.getElementById('nextFromInsVerify'),
            exportInsVerifyBtn: document.getElementById('exportInsVerifyBtn'),

            // Completion Screen
            completionIcon: document.getElementById('completionIcon'),
            completionTitle: document.getElementById('completionTitle'),
            completionSubtitle: document.getElementById('completionSubtitle'),
            completionSummary: document.getElementById('completionSummary'),
            sendEmailBtn: document.getElementById('sendEmailBtn'),
            returnHome: document.getElementById('returnHome'),

            // Note Modal
            noteModal: document.getElementById('noteModal'),
            noteModalTitle: document.getElementById('noteModalTitle'),
            notePatientName: document.getElementById('notePatientName'),
            quickNotes: document.getElementById('quickNotes'),
            customNote: document.getElementById('customNote'),
            closeNoteModal: document.getElementById('closeNoteModal'),
            cancelNote: document.getElementById('cancelNote'),
            saveNote: document.getElementById('saveNote'),

            // Charge Modal
            chargeModal: document.getElementById('chargeModal'),
            chargePatientName: document.getElementById('chargePatientName'),
            chargeCodesGrid: document.getElementById('chargeCodesGrid'),
            chargeCustomNote: document.getElementById('chargeCustomNote'),
            closeChargeModal: document.getElementById('closeChargeModal'),
            cancelCharge: document.getElementById('cancelCharge'),
            saveCharge: document.getElementById('saveCharge'),

            // Settings Modal
            settingsModal: document.getElementById('settingsModal'),
            closeSettings: document.getElementById('closeSettings'),
            changePasscode: document.getElementById('changePasscode'),
            lockTimeout: document.getElementById('lockTimeout'),
            exportAllData: document.getElementById('exportAllData'),
            clearAllData: document.getElementById('clearAllData'),
            emailRecipient: document.getElementById('emailRecipient'),
            saveEmailBtn: document.getElementById('saveEmailBtn'),

            // Email Modal
            emailModal: document.getElementById('emailModal'),
            emailPreview: document.getElementById('emailPreview'),
            closeEmailModal: document.getElementById('closeEmailModal'),
            cancelEmail: document.getElementById('cancelEmail'),
            confirmSendEmail: document.getElementById('confirmSendEmail'),

            // Google Drive
            driveNotConnected: document.getElementById('driveNotConnected'),
            driveConnected: document.getElementById('driveConnected'),
            connectDrive: document.getElementById('connectDrive'),
            disconnectDrive: document.getElementById('disconnectDrive'),
            openDriveFolder: document.getElementById('openDriveFolder'),

            // Toast
            toast: document.getElementById('toast')
        };
    },

    // Bind Events
    bindEvents() {
        // Lock Screen
        this.elements.numBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handlePasscodeInput(btn.dataset.num));
        });
        this.elements.deleteBtn.addEventListener('click', () => this.handlePasscodeDelete());
        this.elements.biometricBtn.addEventListener('click', () => this.handleBiometric());

        // Setup Screen
        this.elements.setupNumBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handleSetupInput(btn.dataset.num));
        });
        this.elements.setupDeleteBtn.addEventListener('click', () => this.handleSetupDelete());

        // Home Screen
        this.elements.startEveningBtn.addEventListener('click', () => this.startHuddle());
        this.elements.settingsBtn.addEventListener('click', () => this.showSettings());
        this.elements.lockBtn.addEventListener('click', () => this.lock());

        // Patient List Screen
        this.elements.loadPatients.addEventListener('click', () => this.loadPatientList());
        this.elements.clearPaste.addEventListener('click', () => this.clearPatientPaste());
        this.elements.continueToHuddle.addEventListener('click', () => this.continueToFirstSection());
        this.elements.backToHome.addEventListener('click', () => this.goToHome());

        // Huddle Section Screen
        this.elements.nextSectionBtn.addEventListener('click', () => this.goToNextSection());
        this.elements.backToPrevSection.addEventListener('click', () => this.goToPreviousSection());
        this.elements.exportSectionBtn.addEventListener('click', () => this.exportCurrentSection());

        // To-Do Section
        this.elements.addTodoBtn.addEventListener('click', () => this.addTodoItem());
        this.elements.todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodoItem();
        });
        this.elements.backFromTodo.addEventListener('click', () => this.goToPreviousSection());
        this.elements.nextFromTodo.addEventListener('click', () => this.goToNextSection());
        this.elements.exportTodoBtn.addEventListener('click', () => this.exportCurrentSection());

        // Chiro 180 Section
        this.elements.backFromChiro180.addEventListener('click', () => this.goToPreviousSection());
        this.elements.nextFromChiro180.addEventListener('click', () => this.goToNextSection());
        this.elements.exportChiro180Btn.addEventListener('click', () => this.exportCurrentSection());

        // Insurance Verification Section
        this.elements.backFromInsVerify.addEventListener('click', () => this.goToPreviousSection());
        this.elements.nextFromInsVerify.addEventListener('click', () => this.goToNextSection());
        this.elements.exportInsVerifyBtn.addEventListener('click', () => this.exportCurrentSection());

        // Completion Screen
        this.elements.sendEmailBtn.addEventListener('click', () => this.showEmailPreview());
        this.elements.returnHome.addEventListener('click', () => this.goToHome());

        // Note Modal
        this.elements.closeNoteModal.addEventListener('click', () => this.hideNoteModal());
        this.elements.cancelNote.addEventListener('click', () => this.hideNoteModal());
        this.elements.saveNote.addEventListener('click', () => this.saveNote());
        this.elements.noteModal.addEventListener('click', (e) => {
            if (e.target === this.elements.noteModal) this.hideNoteModal();
        });

        // Charge Modal
        this.elements.closeChargeModal.addEventListener('click', () => this.hideChargeModal());
        this.elements.cancelCharge.addEventListener('click', () => this.hideChargeModal());
        this.elements.saveCharge.addEventListener('click', () => this.saveCharge());
        this.elements.chargeModal.addEventListener('click', (e) => {
            if (e.target === this.elements.chargeModal) this.hideChargeModal();
        });

        // Settings Modal
        this.elements.closeSettings.addEventListener('click', () => this.hideSettings());
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) this.hideSettings();
        });
        this.elements.changePasscode.addEventListener('click', () => this.handleChangePasscode());
        this.elements.lockTimeout.addEventListener('change', (e) => this.handleTimeoutChange(e));
        this.elements.exportAllData.addEventListener('click', () => this.handleExportAll());
        this.elements.clearAllData.addEventListener('click', () => this.handleClearAll());
        this.elements.saveEmailBtn.addEventListener('click', () => this.saveEmailSettings());

        // Email Modal
        this.elements.closeEmailModal.addEventListener('click', () => this.hideEmailModal());
        this.elements.cancelEmail.addEventListener('click', () => this.hideEmailModal());
        this.elements.confirmSendEmail.addEventListener('click', () => this.sendEmail());
        this.elements.emailModal.addEventListener('click', (e) => {
            if (e.target === this.elements.emailModal) this.hideEmailModal();
        });

        // Google Drive
        this.elements.connectDrive.addEventListener('click', () => this.connectGoogleDrive());
        this.elements.disconnectDrive.addEventListener('click', () => this.disconnectGoogleDrive());

        // Activity detection
        ['click', 'touchstart', 'keypress'].forEach(event => {
            document.addEventListener(event, () => this.resetLockTimer());
        });

        // Visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && StorageManager.isInitialized) {
                this.lock();
            }
        });
    },

    // ==================== SCREEN MANAGEMENT ====================

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    },

    showLockScreen() {
        this.elements.lockScreen.classList.remove('hidden');
        this.elements.setupScreen.classList.add('hidden');
        this.elements.mainApp.classList.add('hidden');
        this.currentPasscode = '';
        this.updatePasscodeDots(this.elements.passcodeDots, 0);
        this.elements.errorMsg.textContent = '';
    },

    showSetupScreen() {
        this.elements.setupScreen.classList.remove('hidden');
        this.elements.lockScreen.classList.add('hidden');
        this.elements.mainApp.classList.add('hidden');
        this.setupPasscode = '';
        this.setupConfirm = false;
        this.updatePasscodeDots(this.elements.setupDots, 0);
        this.elements.setupStatus.textContent = 'Enter new passcode';
    },

    async showMainApp() {
        this.elements.mainApp.classList.remove('hidden');
        this.elements.lockScreen.classList.add('hidden');
        this.elements.setupScreen.classList.add('hidden');

        await this.loadData();
        this.showScreen('homeScreen');
        this.resetLockTimer();
    },

    goToHome() {
        this.currentSectionIndex = 0;
        this.showScreen('homeScreen');
    },

    // ==================== PASSCODE HANDLING ====================

    async handlePasscodeInput(num) {
        if (this.currentPasscode.length >= 4) return;

        this.currentPasscode += num;
        this.updatePasscodeDots(this.elements.passcodeDots, this.currentPasscode.length);

        if (this.currentPasscode.length === 4) {
            const valid = await StorageManager.verifyPasscode(this.currentPasscode);
            if (valid) {
                this.showMainApp();
            } else {
                this.showPasscodeError('Incorrect passcode');
                this.currentPasscode = '';
                setTimeout(() => {
                    this.updatePasscodeDots(this.elements.passcodeDots, 0);
                }, 500);
            }
        }
    },

    handlePasscodeDelete() {
        if (this.currentPasscode.length > 0) {
            this.currentPasscode = this.currentPasscode.slice(0, -1);
            this.updatePasscodeDots(this.elements.passcodeDots, this.currentPasscode.length);
        }
    },

    handleBiometric() {
        this.showToast('Biometric not available in browser', 'error');
    },

    async handleSetupInput(num) {
        if (this.setupPasscode.length >= 4) return;

        this.setupPasscode += num;
        this.updatePasscodeDots(this.elements.setupDots, this.setupPasscode.length);

        if (this.setupPasscode.length === 4) {
            if (!this.setupConfirm) {
                this.setupConfirm = true;
                this.setupFirstPasscode = this.setupPasscode;
                this.setupPasscode = '';
                this.elements.setupStatus.textContent = 'Confirm passcode';
                setTimeout(() => {
                    this.updatePasscodeDots(this.elements.setupDots, 0);
                }, 300);
            } else {
                if (this.setupPasscode === this.setupFirstPasscode) {
                    await StorageManager.setupPasscode(this.setupPasscode);
                    this.showToast('Passcode created', 'success');
                    this.showMainApp();
                } else {
                    this.elements.setupStatus.textContent = 'Passcodes don\'t match';
                    this.setupPasscode = '';
                    this.setupConfirm = false;
                    this.showPasscodeError('', this.elements.setupDots);
                    setTimeout(() => {
                        this.updatePasscodeDots(this.elements.setupDots, 0);
                        this.elements.setupStatus.textContent = 'Enter new passcode';
                    }, 500);
                }
            }
        }
    },

    handleSetupDelete() {
        if (this.setupPasscode.length > 0) {
            this.setupPasscode = this.setupPasscode.slice(0, -1);
            this.updatePasscodeDots(this.elements.setupDots, this.setupPasscode.length);
        }
    },

    updatePasscodeDots(dots, filled) {
        dots.forEach((dot, i) => {
            dot.classList.toggle('filled', i < filled);
            dot.classList.remove('error');
        });
    },

    showPasscodeError(msg, dots = this.elements.passcodeDots) {
        this.elements.errorMsg.textContent = msg;
        dots.forEach(d => d.classList.add('error'));
    },

    // ==================== DATA MANAGEMENT ====================

    async loadData() {
        this.huddleData = await StorageManager.loadData(StorageManager.KEYS.HUDDLE_DATA);
        this.patients = await StorageManager.loadData(StorageManager.KEYS.PATIENTS) || [];
        this.settings = await StorageManager.loadData(StorageManager.KEYS.SETTINGS) || {};

        const today = StorageManager.getTodayString();
        if (this.huddleData.date !== today) {
            this.huddleData = StorageManager.getEmptyHuddleData();
            this.patients = [];
            await this.saveData();
        }

        if (this.settings) {
            if (this.settings.lockTimeout) {
                this.lockTimeout = this.settings.lockTimeout * 60 * 1000;
                this.elements.lockTimeout.value = this.settings.lockTimeout;
            }
            if (this.settings.emailRecipient) {
                this.elements.emailRecipient.value = this.settings.emailRecipient;
            }
        }
    },

    async saveData() {
        await StorageManager.saveData(StorageManager.KEYS.HUDDLE_DATA, this.huddleData);
        await StorageManager.saveData(StorageManager.KEYS.PATIENTS, this.patients);
        await StorageManager.saveData(StorageManager.KEYS.SETTINGS, this.settings);
    },

    updateDateDisplay() {
        const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.elements.dateDisplay.textContent = new Date().toLocaleDateString('en-US', opts);
    },

    // ==================== HUDDLE WORKFLOW ====================

    startHuddle() {
        this.currentSectionIndex = 0;
        this.elements.patientListTitle.textContent = 'Evening Huddle';
        this.renderLoadedPatients();
        this.updateContinueButton();
        this.showScreen('patientListScreen');
    },

    loadPatientList() {
        const text = this.elements.patientPaste.value.trim();
        if (!text) {
            this.showToast('Please paste patient names', 'error');
            return;
        }

        const names = this.parsePatientSchedule(text);

        if (names.length === 0) {
            this.showToast('No valid names found', 'error');
            return;
        }

        this.patients = names;
        this.saveData();
        this.renderLoadedPatients();
        this.updateContinueButton();
        this.elements.patientPaste.value = '';
        this.showToast(`Loaded ${names.length} patients`, 'success');
    },

    // Parse patient schedule format: "TIME FirstName LastName AppointmentType"
    // Lines starting with space/tab are notes and should be skipped
    parsePatientSchedule(text) {
        const lines = text.split('\n');
        const patients = [];
        const seenNames = new Set();

        // Time pattern: matches "2:00pm", "2:30 PM", "14:00", etc.
        const timePattern = /^(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?)\s+(.+)$/;

        // Appointment types to strip from the end
        const appointmentTypes = [
            'adjustment', 'adjustments',
            'new patient exam', 'reactivation exam', 'progress exam', 'normal exam',
            'day 2 report', 'report of findings',
            '15 min treatment', '30 min treatment', '45 min treatment', '60 min treatment',
            'treatment', 'exam', 'consultation', 'consult',
            'follow up', 'follow-up', 'followup',
            'massage', 'therapy', 'evaluation',
            '1st general audit', 'tc 1st insurance audit'
        ];

        for (const line of lines) {
            // Skip lines that start with whitespace (these are notes)
            if (/^\s+/.test(line) && !timePattern.test(line.trim())) {
                continue;
            }

            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const match = trimmedLine.match(timePattern);
            if (match) {
                let remainder = match[2].trim();

                // Remove appointment type from the end (case insensitive)
                for (const apptType of appointmentTypes) {
                    const regex = new RegExp('\\s+' + apptType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i');
                    remainder = remainder.replace(regex, '');
                }

                // Also remove any trailing date patterns like "1/12/2026" or "- 1/12/2026"
                remainder = remainder.replace(/\s*-?\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*.*$/i, '');

                // Also remove trailing notes indicators like "-TC-", "-LP", "MK", etc.
                remainder = remainder.replace(/\s*-\s*[A-Z]{2,3}\s*-?\s*$/i, '');

                // Extract just the name (typically first 2-3 words that look like a name)
                const words = remainder.split(/\s+/);
                let nameWords = [];

                for (const word of words) {
                    // Stop if we hit something that doesn't look like a name
                    // Names are typically capitalized words without numbers
                    if (/^\d/.test(word) || // starts with number
                        /^(per|as|of|the|and|but|for|with|after|before|on|in|at|to|is|are|was|were|will|be|has|have|had)$/i.test(word) || // common words
                        word.length > 15) { // too long to be a name
                        break;
                    }

                    // Check if it looks like a name (starts with capital, mostly letters)
                    if (/^[A-Z][a-zA-Z'-]*$/.test(word)) {
                        nameWords.push(word);
                        // Most names are 2-3 words max
                        if (nameWords.length >= 3) break;
                    } else if (nameWords.length >= 2) {
                        // Already have first and last name, stop here
                        break;
                    }
                }

                if (nameWords.length >= 2) {
                    const patientName = nameWords.join(' ');
                    // Avoid duplicates
                    if (!seenNames.has(patientName.toLowerCase())) {
                        seenNames.add(patientName.toLowerCase());
                        patients.push(patientName);
                    }
                }
            }
        }

        return patients;
    },

    clearPatientPaste() {
        this.elements.patientPaste.value = '';
    },

    renderLoadedPatients() {
        if (this.patients.length === 0) {
            this.elements.loadedPatients.innerHTML = '<p class="empty-state">No patients loaded yet</p>';
            this.elements.patientCountDisplay.textContent = '0 patients loaded';
            return;
        }

        this.elements.loadedPatients.innerHTML = `
            <h4>Loaded Patients</h4>
            <div class="patient-chip-grid">
                ${this.patients.map(p => `<span class="patient-chip">${this.escapeHtml(p)}</span>`).join('')}
            </div>
        `;
        this.elements.patientCountDisplay.textContent = `${this.patients.length} patients loaded`;
    },

    updateContinueButton() {
        this.elements.continueToHuddle.disabled = this.patients.length === 0;
    },

    continueToFirstSection() {
        this.currentSectionIndex = 0;
        this.renderCurrentSection();
    },

    getCurrentSection() {
        return this.sections[this.currentSectionIndex];
    },

    renderCurrentSection() {
        const section = this.getCurrentSection();
        const totalSteps = this.sections.length + 1; // +1 for patient list step
        const currentStep = this.currentSectionIndex + 2;

        // Determine which screen to show
        if (section.screen) {
            this.showScreen(section.screen);
            this.renderSpecialSection(section, currentStep, totalSteps);
        } else {
            this.showScreen('huddleSectionScreen');
            this.renderStandardSection(section, currentStep, totalSteps);
        }
    },

    renderStandardSection(section, currentStep, totalSteps) {
        // Update header
        this.elements.sectionTitle.textContent = section.name;
        this.elements.stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;

        // Update progress bar
        const progress = (currentStep / totalSteps) * 100;
        this.elements.progressBar.style.width = `${progress}%`;

        // Update section info
        this.elements.sectionIcon.textContent = section.icon;
        this.elements.sectionDescription.textContent = section.description;

        // Update next button text
        const isLastSection = this.currentSectionIndex === this.sections.length - 1;
        this.elements.nextSectionBtn.textContent = isLastSection
            ? 'Complete Huddle ✓'
            : 'Next →';

        // Render items and patients
        this.renderSectionItems();
        this.renderPatientGrid();
    },

    renderSpecialSection(section, currentStep, totalSteps) {
        const progress = (currentStep / totalSteps) * 100;

        if (section.id === 'todo24') {
            this.elements.todoStepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
            this.elements.todoProgressBar.style.width = `${progress}%`;
            this.renderTodoList();
        } else if (section.id === 'chiro180') {
            this.elements.chiro180StepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
            this.elements.chiro180ProgressBar.style.width = `${progress}%`;
            this.renderChiro180List();
        } else if (section.id === 'insuranceVerify') {
            this.elements.insVerifyStepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
            this.elements.insVerifyProgressBar.style.width = `${progress}%`;
            this.renderInsuranceVerifyList();
        }
    },

    renderSectionItems() {
        const section = this.getCurrentSection();
        const items = this.huddleData[section.id] || [];

        this.elements.itemCountBadge.textContent = items.length;

        if (items.length === 0) {
            this.elements.addedItemsList.innerHTML = '<p class="empty-state">No items added yet. Tap a patient below to add.</p>';
            return;
        }

        this.elements.addedItemsList.innerHTML = items.map(item => `
            <div class="added-item" data-id="${item.id}">
                <div class="check-circle">✓</div>
                <div class="item-info">
                    <div class="item-name">${this.escapeHtml(item.patientName)}</div>
                    ${item.note ? `<div class="item-note">${this.escapeHtml(item.note)}</div>` : ''}
                    ${item.codes && item.codes.length > 0 ? `<div class="item-codes">${item.codes.map(c => `<span class="code-tag">${c}</span>`).join('')}</div>` : ''}
                </div>
                <button class="remove-btn" data-id="${item.id}">✕</button>
            </div>
        `).join('');

        // Bind remove buttons
        this.elements.addedItemsList.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => this.removeItem(btn.dataset.id));
        });
    },

    renderPatientGrid() {
        const section = this.getCurrentSection();
        const items = this.huddleData[section.id] || [];
        const addedPatients = new Set(items.map(i => i.patientName));

        this.elements.patientGrid.innerHTML = this.patients.map(p => `
            <button class="patient-btn ${addedPatients.has(p) ? 'in-section' : ''}" data-patient="${this.escapeHtml(p)}">
                ${this.escapeHtml(p)}
            </button>
        `).join('');

        this.elements.patientGrid.querySelectorAll('.patient-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (section.type === 'charge-multiselect') {
                    this.showChargeModal(btn.dataset.patient);
                } else {
                    this.showNoteModal(btn.dataset.patient);
                }
            });
        });
    },

    // ==================== TODO LIST ====================

    renderTodoList() {
        const items = this.huddleData.todo24 || [];

        if (items.length === 0) {
            this.elements.todoList.innerHTML = '<p class="empty-state">No tasks added yet</p>';
            return;
        }

        this.elements.todoList.innerHTML = items.map(item => `
            <div class="todo-item" data-id="${item.id}">
                <div class="todo-text">${this.escapeHtml(item.task)}</div>
                <button class="remove-btn" data-id="${item.id}">✕</button>
            </div>
        `).join('');

        this.elements.todoList.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => this.removeTodoItem(btn.dataset.id));
        });
    },

    async addTodoItem() {
        const task = this.elements.todoInput.value.trim();
        if (!task) return;

        if (!this.huddleData.todo24) {
            this.huddleData.todo24 = [];
        }

        this.huddleData.todo24.push({
            id: Date.now().toString(),
            task: task,
            timestamp: new Date().toISOString(),
            date: StorageManager.getTodayString()
        });

        await this.saveData();
        this.elements.todoInput.value = '';
        this.renderTodoList();
        this.showToast('Task added', 'success');
    },

    async removeTodoItem(id) {
        this.huddleData.todo24 = this.huddleData.todo24.filter(i => i.id !== id);
        await this.saveData();
        this.renderTodoList();
    },

    // ==================== CHIRO 180 LIST ====================

    renderChiro180List() {
        if (!this.huddleData.chiro180) {
            this.huddleData.chiro180 = {};
        }

        this.elements.chiro180List.innerHTML = this.patients.map(p => {
            const status = this.huddleData.chiro180[p] || 'pending';
            return `
                <div class="toggle-patient-row" data-patient="${this.escapeHtml(p)}">
                    <span class="patient-name">${this.escapeHtml(p)}</span>
                    <div class="toggle-buttons">
                        <button class="toggle-btn ${status === 'updated' ? 'active success' : ''}" data-status="updated">
                            ✓ Updated
                        </button>
                        <button class="toggle-btn ${status === 'needs-update' ? 'active warning' : ''}" data-status="needs-update">
                            ⚠ Needs Update
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.chiro180List.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('.toggle-patient-row');
                const patient = row.dataset.patient;
                const status = btn.dataset.status;
                this.updateChiro180Status(patient, status);
            });
        });
    },

    async updateChiro180Status(patient, status) {
        this.huddleData.chiro180[patient] = status;
        await this.saveData();
        this.renderChiro180List();
    },

    // ==================== INSURANCE VERIFICATION LIST ====================

    renderInsuranceVerifyList() {
        if (!this.huddleData.insuranceVerify) {
            this.huddleData.insuranceVerify = {};
        }

        this.elements.insuranceVerifyList.innerHTML = this.patients.map(p => {
            const verified = this.huddleData.insuranceVerify[p] || false;
            return `
                <div class="checkbox-patient-row" data-patient="${this.escapeHtml(p)}">
                    <label class="checkbox-label">
                        <input type="checkbox" ${verified ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        <span class="patient-name">${this.escapeHtml(p)}</span>
                    </label>
                </div>
            `;
        }).join('');

        this.elements.insuranceVerifyList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const row = e.target.closest('.checkbox-patient-row');
                const patient = row.dataset.patient;
                this.updateInsuranceVerifyStatus(patient, e.target.checked);
            });
        });
    },

    async updateInsuranceVerifyStatus(patient, verified) {
        this.huddleData.insuranceVerify[patient] = verified;
        await this.saveData();
    },

    // ==================== NAVIGATION ====================

    async goToNextSection() {
        // Auto-export current section to Google Drive before moving on
        await this.autoExportCurrentSection();

        if (this.currentSectionIndex < this.sections.length - 1) {
            this.currentSectionIndex++;
            this.renderCurrentSection();
        } else {
            this.showCompletionScreen();
        }
    },

    // Auto-export current section silently to Google Drive
    async autoExportCurrentSection() {
        // Only auto-export if Google Drive is connected
        if (!GoogleDriveManager.isConnected()) {
            return;
        }

        const section = this.getCurrentSection();
        let items = [];

        if (section.id === 'todo24') {
            items = this.huddleData.todo24 || [];
        } else if (section.id === 'chiro180') {
            items = Object.entries(this.huddleData.chiro180 || {})
                .filter(([_, status]) => status !== 'pending')
                .map(([patient, status]) => ({
                    id: Date.now().toString() + patient,
                    patientName: patient,
                    status: status,
                    date: StorageManager.getTodayString(),
                    timestamp: new Date().toISOString()
                }));
        } else if (section.id === 'insuranceVerify') {
            items = Object.entries(this.huddleData.insuranceVerify || {})
                .map(([patient, verified]) => ({
                    id: Date.now().toString() + patient,
                    patientName: patient,
                    verified: verified,
                    date: StorageManager.getTodayString(),
                    timestamp: new Date().toISOString()
                }));
        } else {
            items = this.huddleData[section.id] || [];
        }

        // Skip if no items to export
        if (items.length === 0) {
            return;
        }

        try {
            await ExcelExporter.exportSection(section.id, items);
            // Silent success - no toast for auto-export
        } catch (e) {
            console.error('Auto-export failed:', e);
            // Only show error if something went wrong
            this.showToast('Auto-sync failed', 'error');
        }
    },

    goToPreviousSection() {
        if (this.currentSectionIndex > 0) {
            this.currentSectionIndex--;
            this.renderCurrentSection();
        } else {
            this.showScreen('patientListScreen');
        }
    },

    showCompletionScreen() {
        this.elements.completionIcon.textContent = '✅';
        this.elements.completionTitle.textContent = 'Evening Huddle Complete!';
        this.elements.completionSubtitle.textContent = 'All sections have been reviewed';

        // Build summary
        let summaryHtml = '';
        this.sections.forEach(section => {
            let count = 0;
            if (section.id === 'todo24') {
                count = (this.huddleData.todo24 || []).length;
            } else if (section.id === 'chiro180') {
                count = Object.keys(this.huddleData.chiro180 || {}).filter(k => this.huddleData.chiro180[k] !== 'pending').length;
            } else if (section.id === 'insuranceVerify') {
                count = Object.keys(this.huddleData.insuranceVerify || {}).filter(k => this.huddleData.insuranceVerify[k]).length;
            } else {
                count = (this.huddleData[section.id] || []).length;
            }
            summaryHtml += `
                <div class="summary-item">
                    <span class="label">${section.icon} ${section.name}</span>
                    <span class="value">${count} items</span>
                </div>
            `;
        });

        this.elements.completionSummary.innerHTML = summaryHtml;
        this.showScreen('completionScreen');
    },

    // ==================== NOTE MODAL ====================

    showNoteModal(patientName) {
        this.currentPatient = patientName;
        this.selectedQuickNote = null;

        const section = this.getCurrentSection();
        this.elements.noteModalTitle.textContent = `Add to ${section.name}`;
        this.elements.notePatientName.textContent = patientName;

        // Render quick notes
        const notes = this.quickNotes[section.id] || [];
        this.elements.quickNotes.innerHTML = notes.map(n => `
            <button class="quick-note-btn" data-note="${this.escapeHtml(n)}">${this.escapeHtml(n)}</button>
        `).join('');

        this.elements.quickNotes.querySelectorAll('.quick-note-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.quickNotes.querySelectorAll('.quick-note-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedQuickNote = btn.dataset.note;
                this.elements.customNote.value = '';
            });
        });

        this.elements.customNote.value = '';
        this.elements.noteModal.classList.remove('hidden');
    },

    hideNoteModal() {
        this.elements.noteModal.classList.add('hidden');
        this.currentPatient = null;
        this.selectedQuickNote = null;
    },

    async saveNote() {
        const note = this.selectedQuickNote || this.elements.customNote.value.trim();
        const section = this.getCurrentSection();

        const item = {
            id: Date.now().toString(),
            patientName: this.currentPatient,
            note: note,
            date: StorageManager.getTodayString(),
            timestamp: new Date().toISOString()
        };

        if (!this.huddleData[section.id]) {
            this.huddleData[section.id] = [];
        }

        this.huddleData[section.id].push(item);
        await this.saveData();

        this.renderSectionItems();
        this.renderPatientGrid();
        this.hideNoteModal();
        this.showToast('Item added', 'success');
    },

    async removeItem(id) {
        const section = this.getCurrentSection();
        this.huddleData[section.id] = this.huddleData[section.id].filter(i => i.id !== id);
        await this.saveData();
        this.renderSectionItems();
        this.renderPatientGrid();
    },

    // ==================== CHARGE MODAL ====================

    showChargeModal(patientName) {
        this.currentPatient = patientName;
        this.selectedChargeCodes = [];

        this.elements.chargePatientName.textContent = patientName;

        // Render charge codes grid
        this.elements.chargeCodesGrid.innerHTML = this.chargeCodes.map(code => `
            <button class="charge-code-btn" data-code="${this.escapeHtml(code)}">${this.escapeHtml(code)}</button>
        `).join('');

        this.elements.chargeCodesGrid.querySelectorAll('.charge-code-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
                const code = btn.dataset.code;
                if (this.selectedChargeCodes.includes(code)) {
                    this.selectedChargeCodes = this.selectedChargeCodes.filter(c => c !== code);
                } else {
                    this.selectedChargeCodes.push(code);
                }
            });
        });

        this.elements.chargeCustomNote.value = '';
        this.elements.chargeModal.classList.remove('hidden');
    },

    hideChargeModal() {
        this.elements.chargeModal.classList.add('hidden');
        this.currentPatient = null;
        this.selectedChargeCodes = [];
    },

    async saveCharge() {
        if (this.selectedChargeCodes.length === 0 && !this.elements.chargeCustomNote.value.trim()) {
            this.showToast('Please select at least one code or add a note', 'error');
            return;
        }

        const item = {
            id: Date.now().toString(),
            patientName: this.currentPatient,
            codes: [...this.selectedChargeCodes],
            note: this.elements.chargeCustomNote.value.trim(),
            date: StorageManager.getTodayString(),
            timestamp: new Date().toISOString()
        };

        if (!this.huddleData.chargePassdown) {
            this.huddleData.chargePassdown = [];
        }

        this.huddleData.chargePassdown.push(item);
        await this.saveData();

        this.renderSectionItems();
        this.renderPatientGrid();
        this.hideChargeModal();
        this.showToast('Charges added', 'success');
    },

    // ==================== EXPORT ====================

    async exportCurrentSection() {
        const section = this.getCurrentSection();
        let items = [];

        if (section.id === 'todo24') {
            items = this.huddleData.todo24 || [];
        } else if (section.id === 'chiro180') {
            // Convert object to array
            items = Object.entries(this.huddleData.chiro180 || {})
                .filter(([_, status]) => status !== 'pending')
                .map(([patient, status]) => ({
                    id: Date.now().toString() + patient,
                    patientName: patient,
                    status: status,
                    date: StorageManager.getTodayString(),
                    timestamp: new Date().toISOString()
                }));
        } else if (section.id === 'insuranceVerify') {
            // Convert object to array
            items = Object.entries(this.huddleData.insuranceVerify || {})
                .map(([patient, verified]) => ({
                    id: Date.now().toString() + patient,
                    patientName: patient,
                    verified: verified,
                    date: StorageManager.getTodayString(),
                    timestamp: new Date().toISOString()
                }));
        } else {
            items = this.huddleData[section.id] || [];
        }

        if (items.length === 0) {
            this.showToast('No items to export', 'error');
            return;
        }

        try {
            const result = await ExcelExporter.exportSection(section.id, items);
            const driveStatus = result.savedToDrive ? ' • Saved to Drive' : '';
            this.showToast(`Exported ${result.newCount} items • Total: ${result.totalCount}${driveStatus}`, 'success');
        } catch (e) {
            console.error('Export failed:', e);
            this.showToast('Export failed', 'error');
        }
    },

    async handleExportAll() {
        try {
            await ExcelExporter.exportAllSections(this.huddleData, this.patients);
            this.showToast('Full export complete', 'success');
        } catch (e) {
            this.showToast('Export failed', 'error');
        }
    },

    // ==================== EMAIL ====================

    showEmailPreview() {
        const email = this.settings?.emailRecipient;
        if (!email) {
            this.showToast('Please set an email address in Settings first', 'error');
            return;
        }

        const emailContent = EmailManager.generateSummary(this.huddleData, this.patients);
        this.elements.emailPreview.innerHTML = emailContent;
        this.elements.emailModal.classList.remove('hidden');
    },

    hideEmailModal() {
        this.elements.emailModal.classList.add('hidden');
    },

    async sendEmail() {
        const email = this.settings?.emailRecipient;
        if (!email) {
            this.showToast('No email address configured', 'error');
            return;
        }

        try {
            await EmailManager.sendSummary(this.huddleData, this.patients, email);
            this.hideEmailModal();
            this.showToast('Email sent successfully', 'success');
        } catch (e) {
            console.error('Email failed:', e);
            this.showToast('Failed to send email: ' + e.message, 'error');
        }
    },

    async saveEmailSettings() {
        const email = this.elements.emailRecipient.value.trim();
        if (!email) {
            this.showToast('Please enter an email address', 'error');
            return;
        }

        this.settings.emailRecipient = email;
        await StorageManager.saveData(StorageManager.KEYS.SETTINGS, this.settings);
        this.showToast('Email saved', 'success');
    },

    // ==================== SETTINGS ====================

    showSettings() {
        this.elements.settingsModal.classList.remove('hidden');
        this.updateDriveUI();
    },

    hideSettings() {
        this.elements.settingsModal.classList.add('hidden');
    },

    // ==================== GOOGLE DRIVE ====================

    async initGoogleDrive() {
        try {
            await GoogleDriveManager.init();
            GoogleDriveManager.onSignInChange = (signedIn) => {
                this.updateDriveUI();
                if (signedIn) {
                    this.showToast('Connected to Google Drive', 'success');
                }
            };
        } catch (e) {
            console.error('Failed to init Google Drive:', e);
        }
    },

    updateDriveUI() {
        const connected = GoogleDriveManager.isConnected();

        if (this.elements.driveNotConnected && this.elements.driveConnected) {
            this.elements.driveNotConnected.classList.toggle('hidden', connected);
            this.elements.driveConnected.classList.toggle('hidden', !connected);

            if (connected && this.elements.openDriveFolder) {
                const folderLink = GoogleDriveManager.getFolderLink();
                if (folderLink) {
                    this.elements.openDriveFolder.href = folderLink;
                }
            }
        }
    },

    async connectGoogleDrive() {
        try {
            this.showToast('Connecting to Google Drive...', 'info');
            await GoogleDriveManager.authorize();
        } catch (e) {
            this.showToast('Failed to connect: ' + e.message, 'error');
        }
    },

    disconnectGoogleDrive() {
        if (confirm('Disconnect from Google Drive?')) {
            GoogleDriveManager.signOut();
            this.updateDriveUI();
            this.showToast('Disconnected from Google Drive', 'success');
        }
    },

    async handleChangePasscode() {
        const old = prompt('Current passcode:');
        if (!old) return;

        const newP = prompt('New passcode (4 digits):');
        if (!newP || newP.length !== 4 || !/^\d+$/.test(newP)) {
            this.showToast('Invalid format', 'error');
            return;
        }

        const confirmP = prompt('Confirm new passcode:');
        if (newP !== confirmP) {
            this.showToast('Passcodes don\'t match', 'error');
            return;
        }

        if (await StorageManager.changePasscode(old, newP)) {
            this.showToast('Passcode changed', 'success');
        } else {
            this.showToast('Incorrect passcode', 'error');
        }
    },

    async handleTimeoutChange(e) {
        this.settings.lockTimeout = parseInt(e.target.value);
        this.lockTimeout = this.settings.lockTimeout * 60 * 1000;
        await StorageManager.saveData(StorageManager.KEYS.SETTINGS, this.settings);
        this.showToast('Timeout updated', 'success');
    },

    async handleClearAll() {
        if (!confirm('Delete ALL data including passcode?')) return;
        if (!confirm('This cannot be undone. Continue?')) return;

        await StorageManager.clearAllData();
        this.showToast('All data cleared', 'success');
        setTimeout(() => location.reload(), 1000);
    },

    // ==================== LOCK / TIMER ====================

    lock() {
        this.clearLockTimer();
        StorageManager.lock();
        this.showLockScreen();
    },

    resetLockTimer() {
        this.clearLockTimer();
        if (StorageManager.isInitialized) {
            this.lockTimer = setTimeout(() => this.lock(), this.lockTimeout);
        }
    },

    clearLockTimer() {
        if (this.lockTimer) {
            clearTimeout(this.lockTimer);
            this.lockTimer = null;
        }
    },

    // ==================== UTILITIES ====================

    showToast(message, type = 'info') {
        this.elements.toast.textContent = message;
        this.elements.toast.className = `toast ${type}`;
        this.elements.toast.classList.remove('hidden');
        setTimeout(() => this.elements.toast.classList.add('hidden'), 3000);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => App.init());
