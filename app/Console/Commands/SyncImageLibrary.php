<?php

namespace App\Console\Commands;

use App\Services\Design\ImageLibrary;
use Illuminate\Console\Command;

class SyncImageLibrary extends Command
{
    protected $signature = 'assets:sync-library';

    protected $description = 'Import existing uploaded project images into the private asset library';

    public function handle(ImageLibrary $library): int
    {
        $this->info($library->syncExisting().' uploaded assets synced to the image library.');

        return self::SUCCESS;
    }
}
