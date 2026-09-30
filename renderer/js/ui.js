export function initUI() {
    const information = document.getElementById('info')
    if (information && window.versions) {
        information.innerText = `This app is using Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), and Electron (v${window.versions.electron()})`
    }

    // Ping / Pong Test
    const pingBtn = document.getElementById('pingBtn')
    const pingStatus = document.getElementById('pingStatus')
    if (pingBtn) {
        pingBtn.addEventListener('click', async () => {
            try {
                const response = await window.versions.ping()
                pingStatus.innerText = response
            } catch (error) {
                console.error('Ping failed:', error)
            }
        })
    }

    // Global Shortcut Listener
    if (window.versions && window.versions.onGlobalShortcut) {
        window.versions.onGlobalShortcut(() => {
            alert('Global shortcut triggered from outside the app!')
        })
    }

    // External Links
    const externalLink = document.querySelector('.external-link')
    if (externalLink) {
        externalLink.addEventListener('click', async (e) => {
            e.preventDefault()
            const url = externalLink.getAttribute('id-link') || externalLink.href
            await window.versions.openExternal(url)
        })
    }

    // Notifications
    const notifyBtn = document.getElementById('notifyBtn')
    if (notifyBtn) {
        notifyBtn.addEventListener('click', async () => {
            await window.versions.showNotification(
                'Electron Showcase',
                'Native desktop notification triggered!'
            )
        })
    }

    // Theme Preference Logic
    const themeToggleBtn = document.getElementById('themeToggleBtn')
    const themeLabel = document.getElementById('themeLabel')

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.remove('light-mode')

            if (themeLabel) {
                themeLabel.innerText = 'Dark Mode'
            }
        } else {
            document.body.classList.add('light-mode')

            if (themeLabel) {
                themeLabel.innerText = 'Light Mode'
            }
        }
    }

    async function initTheme() {
        const savedTheme = window.versions
            ? await window.versions.getPreference('theme')
            : 'light'

        applyTheme(savedTheme || 'light')
    }

    initTheme()

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', async () => {
            const currentTheme = window.versions
                ? await window.versions.getPreference('theme') || 'light'
                : 'light'

            const newTheme =
                currentTheme === 'light'
                    ? 'dark'
                    : 'light'

            if (window.versions) {
                await window.versions.setPreference('theme', newTheme)
            }

            applyTheme(newTheme)
        })
    }

    // File Dialog
    const btn = document.getElementById('btn')
    const filePathElement = document.getElementById('filePath')

    if (btn) {
        btn.addEventListener('click', async () => {
            const filePath = window.versions
                ? await window.versions.openFile()
                : null

            if (filePath && filePathElement) {
                filePathElement.innerText = filePath
            }
        })
    }
}