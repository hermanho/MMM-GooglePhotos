## Installation

1. Install Module
    
    Run the following command. For example, the Magic Mirror directory is `~/MagicMirror`.
    ```sh
    cd ~/MagicMirror/modules
    git clone https://github.com/hermanho/MMM-GooglePhotos.git
    cd MMM-GooglePhotos
    npm run install-prod
    ```

    If you are using Docker

    ```sh
    cd ~/MagicMirror/modules
    git clone https://github.com/hermanho/MMM-GooglePhotos.git
    docker exec -it -w /opt/magic_mirror/modules/MMM-GooglePhotos magic_mirror npm run install-prod
    ```

1. Add MMM-GooglePhotos module config in ~/MagicMirror/config/config.js


## Upgrade

  Run the following command. For example, the Magic Mirror directory is `~/MagicMirror`.
  ```sh
  cd ~/MagicMirror/modules/MMM-GooglePhotos
  git pull
  npm run install-prod
  ```

## Authorise OAuth Token

### Get `token.json`
1. Clone this repo in your local pc and execute `npm install`
2. Go to [Google API Console](https://console.developers.google.com/)
3. From the menu bar, select a project or create a new project.
4. To open the Google API Library, from the Navigation menu, select `APIs & Services > Library`. Don't forget to enble the Google API Services.
5. Search for "Google Photos Library API". Select the correct result and click Enable. (You may need to enable "Google Plus" also.)
6. Then  from the menu, select `APIs & Services > Credentials`.
7. On the Credentials page, click `Create Credentials > OAuth client ID`.
8. Select your Application type as **`Desktop app`**(IMPORTANT!!!) and submit. (Before or After that, you might be asked for making consent screen. do that.)
> Google might change the menu name. So current this would work; ![2022-09-18_18-49-03](https://user-images.githubusercontent.com/2337380/190921355-49162763-0fdd-4b7e-a361-d762046f844d.png)

9. Then, you can download your credential json file from list. Downloaded file name would be `client_secret_xxxx...xxx.json`. rename it as `credentials.json` and save it to your `MMM-GooglePhotos` directory.
10. Now, open your termial
```shell
cd ~/MagicMirror/modules/MMM-GooglePhotos
node generate_token_v2.js
```
10. At first execution, It will open a browser and will ask you to login google account and to consent your allowance.
11. Authorize it and close the browser
12. Copy the file `token.json` and `credentials.json` to the folder `MMM-GooglePhotos` in the remote device

### Stop token from expiring every week
as of 2021, it appears tokens only last 1 week while in 'testing'. This led to users needing to get a new token.json every ~week to 10 days. To get your app out of testing mode, where the token will last indefinately:

1. go to your google cloud console, select your magic mirror project. Then from the navigation menu(top left) -> APIs & Services -> Oath consent screen. This should get you to a site something like https://console.cloud.google.com/apis/credentials/consent?project=[PROJECT_ID] where [PROJECT_ID] is the project ID. This is where the publishing status. It looks like this:

    ![](https://raw.githubusercontent.com/eouia/MMM-GooglePhotos/master/PublishAppScreen.png)

2. click Publish app and review permissions as necessary.
