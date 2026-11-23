// NafaSchool - Interactive Dashboard JavaScript

// Core Fee Calculation Function (from existing TypeScript library)
function calculateOutstandingBalance(totalFee, totalPaid) {
    // Validate inputs
    if (typeof totalFee !== "number" || typeof totalPaid !== "number") {
        throw new Error("totalFee and totalPaid must be numbers");
    }

    if (!Number.isFinite(totalFee) || !Number.isFinite(totalPaid)) {
        throw new Error("totalFee and totalPaid must be finite numbers");
    }

    if (totalFee < 0 || totalPaid < 0) {
        throw new Error("totalFee and totalPaid must not be negative");
    }

    const balance = totalFee - totalPaid;

    // Return 0 if balance is negative (overpayment)
    return Math.max(0, balance);
}

// Format currency for West African CFA franc
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-SN', {
        style: 'currency',
        currency: 'XOF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Update date display
function updateDateDisplay() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        dateElement.textContent = now.toLocaleDateString('fr-SN', options);
    }
}

// Update stats with animation
function updateStats() {
    const stats = document.querySelectorAll('.stat-value');
    stats.forEach(stat => {
        const originalValue = stat.textContent;
        if (originalValue.includes('FCFA') || originalValue.includes(',')) {
            animateNumber(stat, parseInt(originalValue.replace(/[^0-9]/g, '')) || 0);
        }
    });
}

// Animate number counting
function animateNumber(element, finalValue) {
    let currentValue = 0;
    const duration = 1500;
    const increment = finalValue / (duration / 16); // 60fps
    
    function update() {
        currentValue += increment;
        if (currentValue < finalValue) {
            element.textContent = formatCurrency(Math.floor(currentValue));
            requestAnimationFrame(update);
        } else {
            element.textContent = formatCurrency(finalValue);
        }
    }
    
    update();
}

// Calculator functionality
function initializeCalculator() {
    const calculateBtn = document.getElementById('calculateBtn');
    const resetBtn = document.getElementById('resetBtn');
    const totalFeeInput = document.getElementById('totalFee');
    const totalPaidInput = document.getElementById('totalPaid');
    
    if (calculateBtn) {
        calculateBtn.addEventListener('click', handleCalculate);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', handleReset);
    }
    
    // Add input validation
    [totalFeeInput, totalPaidInput].forEach(input => {
        if (input) {
            input.addEventListener('input', validateNumberInput);
            input.addEventListener('blur', formatNumberInput);
        }
    });
}

function validateNumberInput(event) {
    const input = event.target;
    const value = input.value;
    
    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
        input.value = parts[0] + '.' + parts.slice(1).join('');
    } else {
        input.value = cleanValue;
    }
}

function formatNumberInput(event) {
    const input = event.target;
    let value = parseFloat(input.value);
    
    if (isNaN(value)) {
        input.value = '';
        return;
    }
    
    // Round to 2 decimal places
    value = Math.round(value * 100) / 100;
    input.value = value.toLocaleString('fr-SN');
}

function handleCalculate() {
    const totalFeeInput = document.getElementById('totalFee');
    const totalPaidInput = document.getElementById('totalPaid');
    const resultContainer = document.getElementById('resultContainer');
    const resultContent = document.getElementById('resultContent');
    
    if (!totalFeeInput || !totalPaidInput || !resultContainer || !resultContent) {
        console.error('Required calculator elements not found');
        return;
    }
    
    // Get and clean input values
    const totalFee = parseFloat(totalFeeInput.value.replace(/[^0-9.]/g, '') || '0');
    const totalPaid = parseFloat(totalPaidInput.value.replace(/[^0-9.]/g, '') || '0');
    
    // Validate inputs
    let errorMessage = '';
    
    if (isNaN(totalFee) || isNaN(totalPaid)) {
        errorMessage = 'Please enter valid numbers for both fields.';
    } else if (totalFee < 0 || totalPaid < 0) {
        errorMessage = 'Fee and payment amounts cannot be negative.';
    } else if (!Number.isFinite(totalFee) || !Number.isFinite(totalPaid)) {
        errorMessage = 'Please enter finite numbers.';
    }
    
    if (errorMessage) {
        showResult(errorMessage, 'error');
        return;
    }
    
    // Calculate balance using core function
    let balance;
    try {
        balance = calculateOutstandingBalance(totalFee, totalPaid);
    } catch (error) {
        showResult(error.message, 'error');
        return;
    }
    
    // Generate result HTML
    let resultHTML = '';
    
    if (balance === 0 && totalPaid >= totalFee) {
        resultHTML = `
            <div class="result-header">
                <span class="result-icon">✅</span>
                <h4>All Fees Paid!</h4>
            </div>
            <div class="result-details">
                <p>Payment of <strong>${formatCurrency(totalPaid)}</strong> covers the total fee of <strong>${formatCurrency(totalFee)}</strong>.</p>
                ${totalPaid > totalFee ? 
                    `<p class="result-value">Overpayment: ${formatCurrency(totalPaid - totalFee)}</p>` 
                    : ''}
            </div>
        `;
    } else if (balance === 0) {
        resultHTML = `
            <div class="result-header">
                <span class="result-icon">✅</span>
                <h4>No Outstanding Balance</h4>
            </div>
            <div class="result-details">
                <p>Total fee of <strong>${formatCurrency(totalFee)}</strong> has been fully paid.</p>
            </div>
        `;
    } else {
        const percentage = ((balance / totalFee) * 100).toFixed(1);
        resultHTML = `
            <div class="result-header">
                <span class="result-icon">📊</span>
                <h4>Outstanding Balance</h4>
            </div>
            <div class="result-details">
                <p class="result-value">${formatCurrency(balance)}</p>
                <div class="result-breakdown">
                    <div class="breakdown-item">
                        <div class="breakdown-label">Total Fee</div>
                        <div class="breakdown-value">${formatCurrency(totalFee)}</div>
                    </div>
                    <div class="breakdown-item">
                        <div class="breakdown-label">Total Paid</div>
                        <div class="breakdown-value">${formatCurrency(totalPaid)}</div>
                    </div>
                    <div class="breakdown-item">
                        <div class="breakdown-label">Remaining</div>
                        <div class="breakdown-value">${percentage}%</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    resultContent.innerHTML = resultHTML;
    showResult('', 'success');
}

function handleReset() {
    const totalFeeInput = document.getElementById('totalFee');
    const totalPaidInput = document.getElementById('totalPaid');
    const resultContainer = document.getElementById('resultContainer');
    
    if (totalFeeInput) totalFeeInput.value = '150000';
    if (totalPaidInput) totalPaidInput.value = '97500';
    if (resultContainer) {
        resultContainer.style.display = 'none';
        resultContainer.className = 'result-container';
    }
}

function showResult(message, type) {
    const resultContainer = document.getElementById('resultContainer');
    const resultContent = document.getElementById('resultContent');
    
    if (!resultContainer || !resultContent) return;
    
    if (message) {
        resultContent.innerHTML = `
            <div class="result-header">
                <span class="result-icon">⚠️</span>
                <h4>Error</h4>
            </div>
            <div class="result-details">
                <p>${message}</p>
            </div>
        `;
    }
    
    resultContainer.className = `result-container ${type}`;
    resultContainer.style.display = 'block';
    
    // Scroll to result
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Navigation functionality
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.dashboard-section');
    
    // Hide all sections initially
    sections.forEach(section => {
        if (section.id !== 'dashboard') {
            section.style.display = 'none';
        }
    });
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Update active link
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Show selected section
            const targetId = this.getAttribute('href').substring(1);
            sections.forEach(section => {
                if (section.id === targetId) {
                    section.style.display = 'block';
                    section.scrollIntoView({ behavior: 'smooth' });
                } else {
                    section.style.display = 'none';
                }
            });
            
            // Update URL without page reload
            history.pushState(null, null, `#${targetId}`);
        });
    });
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', function() {
        const hash = window.location.hash.substring(1) || 'dashboard';
        const targetLink = document.querySelector(`.nav-links a[href="#${hash}"]`);
        if (targetLink) {
            targetLink.click();
        }
    });
    
    // Set initial state based on URL hash
    const initialHash = window.location.hash.substring(1) || 'dashboard';
    const initialLink = document.querySelector(`.nav-links a[href="#${initialHash}"]`);
    if (initialLink) {
        initialLink.click();
    }
}

// Quick actions functionality
function initializeQuickActions() {
    const actionButtons = document.querySelectorAll('.action-btn');
    const actionMessages = {
        'new-student': 'Opening student registration form...',
        'record-payment': 'Opening payment recording interface...',
        'generate-report': 'Generating fee collection report...',
        'send-reminder': 'Preparing fee reminder messages...'
    };
    
    actionButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const action = this.dataset.action;
            const message = actionMessages[action] || 'Processing request...';
            
            // Show notification
            showNotification(message);
            
            // Simulate action with timeout
            setTimeout(() => {
                showNotification('Action completed successfully!', 'success');
            }, 1500);
        });
    });
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✅' : 'ℹ️'}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#d4edda' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : '#0c5460'};
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
    `;
    
    // Add close button styles
    notification.querySelector('.notification-close').style.cssText = `
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0 0.5rem;
        margin-left: auto;
    `;
    
    // Add keyframe animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Mobile menu toggle
function initializeMobileMenu() {
    const menuToggle = document.createElement('button');
    menuToggle.className = 'mobile-menu-toggle';
    menuToggle.innerHTML = '☰';
    menuToggle.style.cssText = `
        display: none;
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 1001;
        background: var(--secondary-color);
        color: white;
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        font-size: 1.5rem;
        cursor: pointer;
        box-shadow: var(--shadow);
    `;
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.before(menuToggle);
        
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('mobile-visible');
            document.body.classList.toggle('menu-open');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('mobile-visible');
                document.body.classList.remove('menu-open');
            }
        });
        
        // Media query for mobile
        const mediaQuery = window.matchMedia('(max-width: 991px)');
        function handleMobileChange(e) {
            if (e.matches) {
                menuToggle.style.display = 'block';
                sidebar.classList.remove('mobile-visible');
            } else {
                menuToggle.style.display = 'none';
                sidebar.classList.add('mobile-visible');
            }
        }
        mediaQuery.addListener(handleMobileChange);
        handleMobileChange(mediaQuery);
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('NafaSchool Dashboard Initializing...');
    
    // Update date
    updateDateDisplay();
    
    // Animate stats
    setTimeout(updateStats, 500);
    
    // Initialize calculator
    initializeCalculator();
    
    // Initialize navigation
    initializeNavigation();
    
    // Initialize quick actions
    initializeQuickActions();
    
    // Initialize mobile menu
    initializeMobileMenu();
    
    // Add mobile sidebar styles
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 991px) {
            .sidebar {
                position: fixed;
                top: 0;
                left: -300px;
                height: 100vh;
                width: 280px;
                z-index: 1000;
                transition: left 0.3s ease;
                overflow-y: auto;
            }
            
            .sidebar.mobile-visible {
                left: 0;
            }
            
            body.menu-open::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 999;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Test the core calculation function
    console.log('Testing core calculation function...');
    const testCases = [
        { fee: 100000, paid: 75000, expected: 25000 },
        { fee: 100000, paid: 100000, expected: 0 },
        { fee: 100000, paid: 120000, expected: 0 },
        { fee: 0, paid: 0, expected: 0 }
    ];
    
    testCases.forEach((test, index) => {
        const result = calculateOutstandingBalance(test.fee, test.paid);
        const passed = result === test.expected;
        console.log(`Test ${index + 1}: ${passed ? '✅' : '❌'} Fee: ${test.fee}, Paid: ${test.paid}, Expected: ${test.expected}, Got: ${result}`);
    });
    
    console.log('NafaSchool Dashboard Ready!');
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateOutstandingBalance };
}