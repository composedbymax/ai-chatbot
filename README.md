```
:::'###::::'####:                         
::'## ##:::. ##::                         
:'##:. ##::: ##::                         
'##:::. ##:: ##::                         
 #########:: ##::                         
 ##.... ##:: ##::                         
 ##:::: ##:'####:                         
..:::::..::....::                         
:'######::'##::::'##::::'###::::'########:
'##... ##: ##:::: ##:::'## ##:::... ##..::
 ##:::..:: ##:::: ##::'##:. ##::::: ##::::
 ##::::::: #########:'##:::. ##:::: ##::::
 ##::::::: ##.... ##: #########:::: ##::::
 ##::: ##: ##:::: ##: ##.... ##:::: ##::::
. ######:: ##:::: ##: ##:::: ##:::: ##::::
:......:::..:::::..::..:::::..:::::..:::::
```

A lightweight chat interface that uses the **OpenRouter API** and automatically filters for free models. Conversations are stored locally in the browser.

---

## Features

- Automatic discovery of free models  
- Multi-message chat support  
- Local conversation history via IndexedDB  
- Rate limit warnings from OpenRouter  
- Sidebar UI with search, rename, delete, and drag reorder  

---

## Setup

- PHP 8+ with cURL enabled  
- OpenRouter API key  

### `config.php`

Create a file in the project root:

```php
<?php
return [
    'openrouter_api_key' => 'YOUR_OPENROUTER_API_KEY'
];
```

Do **not** commit this file.

---

## License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**.

You may use, modify, and distribute this software, but **any derivative work
must also be licensed under GPLv3 and remain open-source**.

See the [LICENSE file](https://github.com/composedbymax/openrouter-chatbot/blob/main/LICENSE) for full details.