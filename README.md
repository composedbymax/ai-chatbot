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