# Point of sale system.
This is a school project and is not ment to be used
as actual infrastructure. 

## How to run
1. Install docker
2. Run `docker compose build`
3. Run `docker compose up -d`

To see the logs when it is running run the command `docker compose logs -f`

## How to use
When the compose project is running it will be accessable at `localhost:3000`
this will show you the menu. To administrate go to `localhost:3000/login`. 
There is no login button on basic menu. This is because of security through
obscurity. The default username is `Admin` and the password is `Password123`.
The password should be changed via the ui.

