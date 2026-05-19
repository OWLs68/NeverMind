# Hetzner AI Tester — інструкція для Романа

> Створено: OBErR 19.05.2026. Після того як Roman створив Anthropic API key (Claude Haiku 4.5) і має PAT GitHub token.

Покрокова інструкція для запуску AI-тестера на 94.130.25.22. Усі скрипти готові, ти тільки запускаєш по черзі.

---

## Перед стартом — підготуй

1. ✅ **GitHub PAT** (Fine-grained):
   - github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - **Token name:** `ai-tester-hetzner`
   - **Expiration:** 90 днів
   - **Repository access:** Only `OWLs68/NeverMind`
   - **Repository permissions:**
     - **Contents:** Read and write
     - **Metadata:** Read-only (автоматично)
   - Скопіюй `ghp_...` або `github_pat_...` ключ

2. ✅ **Anthropic API key** (тестер):
   - console.anthropic.com → Settings → API Keys → Create Key
   - Name: `ai-tester-hetzner`
   - Спочатку Limits → $5/month cap для безпеки
   - Скопіюй `sk-ant-...` ключ

Збережи обидва ключі — потрібні через 2 хвилини.

---

## Крок 1: SSH на сервер

```bash
ssh root@94.130.25.22
```

Якщо запитає пароль — введи root password з Hetzner cloud.

---

## Крок 2: Зклонувати NM repo (~30 сек)

```bash
git clone https://github.com/OWLs68/NeverMind.git /tmp/nm-setup
cd /tmp/nm-setup
```

---

## Крок 3: Запустити setup (~3 хв)

```bash
sudo bash scripts/hetzner-setup.sh "ghp_твій_PAT_тут" "sk-ant-твій_anthropic_key_тут"
```

**УВАГА:** PAT і Anthropic ключ ВИДНО у командному рядку (історія bash). Це OK для headless сервера де тільки ти заходиш, але після завершення тестера — `history -c` щоб очистити.

Що скрипт зробить:
- Створить юзера `nmtester`
- Перенесить browser-harness + chrome-profile у `/home/nmtester/`
- Встановить anthropic SDK
- Зклонує NM repo у `/home/nmtester/nevermind`
- Створить .env з твоїми ключами (chmod 600)
- Запустить Chrome як systemd service (auto-restart)
- Встановить fail2ban (SSH brute-force захист)

Очікувані повідомлення:
```
=== [1/8] Створюємо юзера nmtester ===
=== [2/8] Переносимо browser-harness + chrome-profile ===
=== [3/8] uv + venv + anthropic SDK ===
=== [4/8] Clone NM repo через credential store ===
    ✅ git push працює
=== [5/8] .env з ключами ===
=== [6/8] systemd service для Chrome headless ===
    ✅ chrome-tester.service працює (CDP на 9222)
=== [7/8] fail2ban (SSH brute-force захист) ===
    ✅ fail2ban активний
=== [8/8] SSH PasswordAuthentication ===
    ⚠️  SSH PasswordAuthentication ВРУЧНУ (інструкція у коментарях скрипта)

🎉 Hetzner setup завершено!
```

Якщо побачив `⚠️` — щось не так. Скопіюй вивід сюди.

---

## Крок 4: Перший ручний запуск тестера (~1-2 хв)

```bash
sudo -u nmtester /home/nmtester/.venv/bin/python3 /home/nmtester/nevermind/scripts/ai-tester.py --smoke --force
```

`--force` обходить schedule check (інакше тестер скаже "ще рано"). Виконає 5 сценаріїв (за tester-config `max_tests_per_run: 5`).

Очікувано побачиш:
```
[OK] git pull main
--- test_1_boot_health ---
✅ test-1-boot-health: ok
--- test_2_navigation_8_tabs ---
✅ test-2-navigation: ok
...
=== 5/5 pass · pushed=True ===
```

Якщо `pushed=True` — звіт уже у NM repo! Подивись:
- https://github.com/OWLs68/NeverMind/branches → бачиш гілку `claude/ai-tester-{ts}`
- Або зайди у репо → `_ai-tools/tester-status.json` → бачиш `last_run_utc` = щойно

---

## Крок 5: Встановити cron (~30 сек)

```bash
cd /tmp/nm-setup && sudo bash scripts/setup-cron.sh
```

Crontab створиться для nmtester. Сценарії будуть запускатись щогодини, але tester-config (schedule_per_day=3) обмежить реальні запуски до 3 за добу (кожні 8 годин).

---

## Крок 6 (опційно, але рекомендую): SSH ключ замість пароля

**ПЕРЕД відключенням пароля — переконайся що SSH ключ працює!** Інакше втратиш доступ до сервера.

На своєму Mac:

```bash
# Скопіюй свій публічний ключ на сервер (як root, потім перенесемо)
ssh-copy-id root@94.130.25.22
```

Якщо `ssh-copy-id` не встановлений: `brew install ssh-copy-id` АБО вручну:
```bash
cat ~/.ssh/id_rsa.pub | ssh root@94.130.25.22 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Перевір що працює БЕЗ пароля:
```bash
ssh root@94.130.25.22 "echo test"
```

Якщо «test» вивелося без запиту пароля — ключ працює. Тоді **на сервері** розкоментуй блок у hetzner-setup.sh (або зроби вручну):

```bash
sudo nano /etc/ssh/sshd_config
# Знайди PasswordAuthentication і постав no:
#   PasswordAuthentication no
#   PermitRootLogin prohibit-password
sudo systemctl reload sshd
```

Тепер сервер тільки з ключем. fail2ban захищає від спроб brute-force.

---

## Що бачитимеш у NM repo

Після першого запуску:

- **`_ai-tools/tester-status.json`** — last_run_utc, summary з кількістю pass/fail, last_failures (max 5).
- **`_ai-tools/tester-log.md`** — журнал останніх запусків з результатами.
- **Branch `claude/ai-tester-{ts}`** — окрема гілка, auto-merge workflow merge'не у main (якщо є цей workflow — інакше merge вручну).

NM-Claude при наступному `/start` побачить `last_run_utc` і покаже:
> «AI-тестер: 2 год тому, 5/5 pass · v932».

Якщо щось зламається у NeverMind після твого commit — тестер наступного запуску ловить:
> «AI-тестер: 1 fail у Сценарій 9 — B-180 REGRESSION. Скрін: /home/nmtester/screenshots/test-9-...png»

Ти тоді SSH у сервер, дивишся скрін, фіксиш баг у NM-сесії.

---

## Команди для дебагу

```bash
# Логи cron
sudo -u nmtester tail -50 /home/nmtester/cron.log

# Статус Chrome
systemctl status chrome-tester
curl http://127.0.0.1:9222/json/version

# Стан browser-harness
sudo -u nmtester /home/nmtester/.local/bin/browser-harness --doctor

# Ручний запуск з verbose
sudo -u nmtester /home/nmtester/.venv/bin/python3 /home/nmtester/nevermind/scripts/ai-tester.py --smoke --force

# Тест AI-команди (з tester-commands.md)
sudo -u nmtester /home/nmtester/.venv/bin/python3 /home/nmtester/nevermind/scripts/ai-tester.py --cmd "перевір що Settings відкривається без помилок"

# Перевір що Chrome не вмер
systemctl restart chrome-tester
```

---

## Якщо щось зламалось

1. **`git push fails`** — PAT неправильний або scope обмежений. Перегенеруй PAT з Contents: Read and write.
2. **`Chrome CDP unreachable`** — `systemctl restart chrome-tester`. Якщо ще не працює — `journalctl -u chrome-tester -n 50`.
3. **`anthropic.AuthenticationError`** — Anthropic ключ неправильний у `.env`. Edit `/home/nmtester/.config/ai-tester/.env`.
4. **`git pull failed`** — мабуть локальні зміни у `/home/nmtester/nevermind`. `cd /home/nmtester/nevermind && sudo -u nmtester git reset --hard origin/main`.
5. **Сценарій 9 фейлить постійно** — це AI-тест, фейл нормальний. Перевір що це не B-180 регресія у тестерному коді (B-180 закрито nliW8, але config міг змінитись).

---

## Бюджет (важливо!)

- Anthropic: $5/міс cap (поставив у Console)
- 1 запуск = 5 сценаріїв × ~500 токенів = ~$0.01
- 3 запуски/день × 30 днів = $0.90/міс реально (за глаза вистачить $5 cap)
- Hetzner CX21 (твій сервер): ~€10/міс

**Загалом ~$15-20/міс за 24/7 тестер з 3 повними прогонами на день.**

---

## Що залишилось зробити (поза цією інструкцією)

- **Інші сценарії 6-10** реалізовані як шаблони — деякі можуть потребувати уточнення селекторів коли Роман побачить як вони падають на реальному сайті. Це нормально — оновлюємо `ai-tester.py` під реальний DOM після першого запуску.
- **Auto-merge workflow** `.github/workflows/auto-merge-tester.yml` — потребує перевірки що існує і має whitelist для `claude/ai-tester-*` гілки. Якщо немає — додати окремо.
- **OpenAI key cleanup** — якщо колись використовувався, видали з .env. Зараз тестер тільки Anthropic.

Готово. Тестер живе на сервері 24/7 і пише звіти у твоє git репо щодня.
