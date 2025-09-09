// Fit2Run Dashboard - Site-wide JavaScript

// Global utilities
window.FitRunDashboard = {
    // API base URL
    apiUrl: '',
    
    // Format currency
    formatCurrency: function(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },
    
    // Format percentage
    formatPercentage: function(value) {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}%`;
    },
    
    // Show loading indicator
    showLoading: function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '<div class="loading-spinner"></div> Loading...';
        }
    },
    
    // Hide loading indicator
    hideLoading: function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '';
        }
    },
    
    // Show error message
    showError: function(message, containerId = 'errorContainer') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="dashboard-card" style="background-color: #fff4ce; border-left: 4px solid var(--error-color);">
                    <h3 style="color: var(--error-color);">
                        <span class="ms-Icon ms-Icon--Error"></span>
                        Error
                    </h3>
                    <p>${message}</p>
                </div>
            `;
            container.style.display = 'block';
        }
    },
    
    // Make API request with error handling
    apiRequest: async function(url, options = {}) {
        try {
            const response = await fetch(this.apiUrl + url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
};

// Health status monitoring
function initializeHealthMonitoring() {
    const updateHealthStatus = async () => {
        try {
            const response = await fetch('/health');
            const status = await response.text();
            
            const healthElements = document.querySelectorAll('#health-status');
            healthElements.forEach(element => {
                if (status === 'Healthy') {
                    element.querySelector('.ms-Icon').className = 'ms-Icon ms-Icon--StatusCircleCheckmark status-healthy';
                    element.querySelector('span:last-child').textContent = 'System Healthy';
                } else {
                    element.querySelector('.ms-Icon').className = 'ms-Icon ms-Icon--StatusCircleErrorX status-error';
                    element.querySelector('span:last-child').textContent = 'System Issues';
                }
            });
        } catch (error) {
            console.error('Health check failed:', error);
            const healthElements = document.querySelectorAll('#health-status');
            healthElements.forEach(element => {
                element.querySelector('.ms-Icon').className = 'ms-Icon ms-Icon--StatusCircleErrorX status-error';
                element.querySelector('span:last-child').textContent = 'Health Check Failed';
            });
        }
    };
    
    // Update immediately and then every 30 seconds
    updateHealthStatus();
    setInterval(updateHealthStatus, 30000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize health monitoring
    initializeHealthMonitoring();
    
    // Add click handlers for navigation hover effects
    const navGroups = document.querySelectorAll('.nav-group');
    navGroups.forEach(group => {
        const label = group.querySelector('.nav-label');
        const items = group.querySelector('.nav-items');
        
        if (label && items) {
            // Close menu when clicking outside
            document.addEventListener('click', function(event) {
                if (!group.contains(event.target)) {
                    items.style.display = 'none';
                }
            });
        }
    });
    
    // Add smooth transitions for Microsoft-style animations
    const cards = document.querySelectorAll('.dashboard-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('card-fade-in');
    });
});

// Add CSS animation for cards
const style = document.createElement('style');
style.textContent = `
    .card-fade-in {
        animation: fadeInUp 0.6s ease forwards;
        opacity: 0;
        transform: translateY(20px);
    }
    
    @keyframes fadeInUp {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .status-error {
        color: var(--error-color);
    }
    
    /* Responsive table */
    @media (max-width: 768px) {
        .data-table {
            font-size: 12px;
        }
        
        .data-table th,
        .data-table td {
            padding: 8px 4px;
        }
        
        .stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
`;

document.head.appendChild(style);